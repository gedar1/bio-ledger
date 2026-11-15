import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePlatformSchema } from "../../src/server/services/platformSchema.js";
import { AccountantAuthService } from "../../src/server/services/AccountantAuthService.js";
import { TenantRegistryService } from "../../src/server/services/TenantRegistryService.js";
import { TenantAuthService } from "../../src/server/services/TenantAuthService.js";
import { setupLedgerRoutes } from "../../src/server/routes/LedgerRoutes.js";

type Handler = (params?: unknown) => Promise<{ _statusCode: number; body: any }>;

describe("estado de cuenta y reglas del contador", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let handlers: Record<string, Handler>;
  let ledger: { dispose(): Promise<void> };
  let accountantToken: string;
  let otherAccountantToken: string;
  let clientToken: string;
  let categoryId: number;

  beforeEach(async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    dir = mkdtempSync(join(tmpdir(), "statement-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);

    const accountants = new AccountantAuthService(db);
    const account = await accountants.createAccountant({ username: "contador", password: "clave-de-prueba-larga" });
    db.prepare("INSERT INTO platform_accounts (username, password_hash) VALUES ('otro', 'x:y')").run();
    accountantToken = accountants.issueToken(account);
    otherAccountantToken = accountants.issueToken({ id: 2, username: "otro" });

    const registry = new TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
    const tenantAuth = new TenantAuthService(registry);
    registry.create({ tenant_id: "cliente-a", display_name: "A", profile: "domain", owner_id: String(account.id) });
    clientToken = tenantAuth.issueTenantToken("cliente-a", "domain", "operator").token;

    handlers = {};
    ledger = setupLedgerRoutes(
      { registerData: (name: string, fn: Handler) => (handlers[name] = fn) } as never,
      tenantAuth,
      dir,
    );

    const cats = await handlers["ledger/categories/list"]({ _authHeader: `Bearer ${clientToken}` });
    categoryId = cats.body.data.categories[0].id;
  });

  afterEach(async () => {
    await ledger.dispose();
    db.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    vi.unstubAllEnvs();
  });

  const gasto = (over: Record<string, unknown> = {}) => ({
    fecha: "2025-03-10",
    importe_cents: 12100,
    tasa_btw: 21,
    concepto: "Gasto",
    categoria_id: 0,
    ...over,
  });

  it("el contador puede corregir la tasa de un gasto pendiente", async () => {
    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto({ categoria_id: categoryId, tasa_btw: 9 }),
    });
    const id = created.body.data.expense.id;

    const fixed = await handlers["ledger/accountant/expenses/update"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id,
      ...gasto({ categoria_id: categoryId, tasa_btw: 21, con_soporte: true }),
    });
    expect(fixed._statusCode).toBe(200);
    expect(fixed.body.data.expense.tasa_btw).toBe(21);
    expect(fixed.body.data.expense.con_soporte).toBe(true);
  });

  it("no se corrige un gasto ya decidido", async () => {
    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto({ categoria_id: categoryId }),
    });
    const id = created.body.data.expense.id;
    await handlers["ledger/accountant/expenses/decide"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id,
      decision: "APROBADO",
    });

    const res = await handlers["ledger/accountant/expenses/update"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id,
      ...gasto({ categoria_id: categoryId }),
    });
    expect(res._statusCode).toBe(409);
  });

  it("el estado de cuenta suma solo aprobados y deja el deducible en 0 hasta confirmarlo", async () => {
    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto({ categoria_id: categoryId, con_soporte: true }),
    });
    await handlers["ledger/accountant/expenses/decide"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id: created.body.data.expense.id,
      decision: "APROBADO",
    });

    const statement = await handlers["ledger/statement"]({
      _authHeader: `Bearer ${clientToken}`,
      periodo: "2025-03",
    });
    expect(statement._statusCode).toBe(200);
    expect(statement.body.data.statement.aprobados.total_cents).toBe(12100);
    expect(statement.body.data.statement.aprobados.deducible_cents).toBe(0);
  });

  it("confirmar la deducibilidad de una categoría la refleja en el estado de cuenta", async () => {
    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto({ categoria_id: categoryId, con_soporte: true }),
    });
    await handlers["ledger/accountant/expenses/decide"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id: created.body.data.expense.id,
      decision: "APROBADO",
    });

    await handlers["ledger/accountant/categories/deducible"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      categoria_id: categoryId,
      deducible: true,
    });

    const statement = await handlers["ledger/accountant/statement"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      periodo: "2025-03",
    });
    expect(statement.body.data.statement.aprobados.deducible_cents).toBe(12100);
  });

  it("el cliente ve sus pendientes en el estado de cuenta", async () => {
    await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto({ categoria_id: categoryId }),
    });

    const statement = await handlers["ledger/statement"]({
      _authHeader: `Bearer ${clientToken}`,
      periodo: "2025-03",
    });
    expect(statement.body.data.statement.pendientes).toEqual({ cantidad: 1, total_cents: 12100 });
    expect(statement.body.data.statement.aprobados.cantidad).toBe(0);
  });

  it("un periodo inválido responde 422", async () => {
    const res = await handlers["ledger/statement"]({ _authHeader: `Bearer ${clientToken}`, periodo: "2025-99" });
    expect(res._statusCode).toBe(422);
  });

  it("otro contador no ve el estado de cuenta de un cliente ajeno", async () => {
    const res = await handlers["ledger/accountant/statement"]({
      _authHeader: `Bearer ${otherAccountantToken}`,
      tenant_id: "cliente-a",
      periodo: "2025-03",
    });
    expect(res._statusCode).toBe(404);
  });
});
