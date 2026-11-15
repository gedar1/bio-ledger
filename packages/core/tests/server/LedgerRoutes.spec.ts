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
import { buildTokenVerifier } from "../../src/server/middleware/requestAccess.js";

type Handler = (params?: unknown) => Promise<{ _statusCode: number; body: any }>;

describe("rutas de gastos", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let tenantAuth: TenantAuthService;
  let handlers: Record<string, Handler>;
  let accountantToken: string;
  let otherAccountantToken: string;
  let clientToken: string;
  let ledger: { dispose(): Promise<void> };

  beforeEach(async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    dir = mkdtempSync(join(tmpdir(), "ledger-routes-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);

    const accountants = new AccountantAuthService(db);
    const account = await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });
    db.prepare("INSERT INTO platform_accounts (username, password_hash) VALUES ('otro', 'x:y')").run();
    accountantToken = accountants.issueToken(account);
    otherAccountantToken = accountants.issueToken({ id: 2, username: "otro" });

    const tenantsDir = join(dir, "tenants");
    const registry = new TenantRegistryService(tenantsDir);
    registry.initialize(db);
    tenantAuth = new TenantAuthService(registry);
    registry.create({ tenant_id: "cliente-a", display_name: "A", profile: "domain", owner_id: String(account.id) });
    registry.create({ tenant_id: "cliente-b", display_name: "B", profile: "domain", owner_id: "999" });
    clientToken = tenantAuth.issueTenantToken("cliente-a", "domain", "operator").token;

    handlers = {};
    ledger = setupLedgerRoutes(
      {
        registerData: (name: string, fn: Handler) => {
          handlers[name] = fn;
        },
      } as never,
      tenantAuth,
      dir,
    );
  });

  afterEach(async () => {
    await ledger.dispose();
    db.close();
    // Windows puede tardar en soltar el archivo tras cerrar la base.
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    vi.unstubAllEnvs();
  });

  const gasto = {
    fecha: "2025-02-14",
    importe_cents: 2400,
    tasa_btw: 21,
    concepto: "Cartuchos",
  };

  it("el cliente crea y lista solo sus gastos, creados por él", async () => {
    const categoryId = (await handlers["ledger/categories/list"]({ _authHeader: `Bearer ${clientToken}` })).body.data.categories[0].id;

    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto,
      categoria_id: categoryId,
    });
    expect(created._statusCode).toBe(201);
    expect(created.body.data.expense.creado_por).toBe("CLIENT");

    const list = await handlers["ledger/expenses/list"]({ _authHeader: `Bearer ${clientToken}` });
    expect(list.body.data.expenses).toHaveLength(1);
  });

  it("el contador registra y aprueba gastos de su cliente", async () => {
    const categoryId = (await handlers["ledger/categories/list"]({ _authHeader: `Bearer ${clientToken}` })).body.data.categories[0].id;
    const created = await handlers["ledger/accountant/expenses/create"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      ...gasto,
      categoria_id: categoryId,
    });
    expect(created.body.data.expense.creado_por).toBe("ACCOUNTANT");

    const decided = await handlers["ledger/accountant/expenses/decide"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id: created.body.data.expense.id,
      decision: "APROBADO",
    });
    expect(decided._statusCode).toBe(200);
    expect(decided.body.data.expense.estado).toBe("APROBADO");
  });

  it("el contador no ve ni decide gastos de un cliente ajeno", async () => {
    const res = await handlers["ledger/accountant/expenses/list"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-b",
    });
    expect(res._statusCode).toBe(404);

    const otro = await handlers["ledger/accountant/expenses/list"]({
      _authHeader: `Bearer ${otherAccountantToken}`,
      tenant_id: "cliente-a",
    });
    expect(otro._statusCode).toBe(404);
  });

  it("el rechazo sin nota responde 422", async () => {
    const categoryId = (await handlers["ledger/categories/list"]({ _authHeader: `Bearer ${clientToken}` })).body.data.categories[0].id;
    const created = await handlers["ledger/expenses/create"]({
      _authHeader: `Bearer ${clientToken}`,
      ...gasto,
      categoria_id: categoryId,
    });

    const res = await handlers["ledger/accountant/expenses/decide"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
      id: created.body.data.expense.id,
      decision: "RECHAZADO",
    });
    expect(res._statusCode).toBe(422);
  });

  it("la compuerta separa los endpoints de cliente y de contador", () => {
    const verify = buildTokenVerifier(() => tenantAuth);

    expect(verify(`Bearer ${accountantToken}`, "/api/ledger/accountant/expenses/list")).toBe("allow");
    expect(verify(`Bearer ${accountantToken}`, "/api/ledger/expenses/list")).toBe("forbidden");
    expect(verify(`Bearer ${clientToken}`, "/api/ledger/expenses/list")).toBe("allow");
    expect(verify(`Bearer ${clientToken}`, "/api/ledger/accountant/expenses/list")).toBe("forbidden");
  });
});
