import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePlatformSchema } from "../../src/server/services/platformSchema.js";
import { AccountantAuthService } from "../../src/server/services/AccountantAuthService.js";
import { TenantRegistryService } from "../../src/server/services/TenantRegistryService.js";
import { TenantAuthService } from "../../src/server/services/TenantAuthService.js";
import { setupAccountantTenantRoutes } from "../../src/server/routes/AccountantAuthRoutes.js";
import { setupLedgerRoutes } from "../../src/server/routes/LedgerRoutes.js";

type Handler = (params?: unknown) => Promise<{ _statusCode: number; body: any }>;

describe("listas del contador", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let handlers: Record<string, Handler>;
  let ledger: { dispose(): Promise<void> };
  let accountantToken: string;
  let otherToken: string;

  beforeEach(async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    dir = mkdtempSync(join(tmpdir(), "acc-lists-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);

    const accountants = new AccountantAuthService(db);
    const account = await accountants.createAccountant({ username: "contador", password: "clave-de-prueba-larga" });
    db.prepare("INSERT INTO platform_accounts (username, password_hash) VALUES ('otro', 'x:y')").run();
    accountantToken = accountants.issueToken(account);
    otherToken = accountants.issueToken({ id: 2, username: "otro" });

    const registry = new TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
    const tenantAuth = new TenantAuthService(registry);
    registry.create({ tenant_id: "cliente-a", display_name: "Cliente A", profile: "domain", owner_id: String(account.id) });
    registry.create({ tenant_id: "cliente-b", display_name: "Cliente B", profile: "domain", owner_id: "2" });
    await tenantAuth.resetTempPassword("cliente-a");

    handlers = {};
    const fakeHealth = { registerData: (name: string, fn: Handler) => (handlers[name] = fn) };
    setupAccountantTenantRoutes(fakeHealth as never, registry, tenantAuth);
    ledger = setupLedgerRoutes(fakeHealth as never, tenantAuth, dir);
  });

  afterEach(async () => {
    await ledger.dispose();
    db.close();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    vi.unstubAllEnvs();
  });

  it("el contador ve solo sus clientes, con la marca de contraseña temporal", async () => {
    const res = await handlers["accountant/clients"]({ _authHeader: `Bearer ${accountantToken}` });

    expect(res._statusCode).toBe(200);
    const ids = res.body.data.clients.map((c: { tenant_id: string }) => c.tenant_id);
    expect(ids).toEqual(["cliente-a"]);
    expect(res.body.data.clients[0].must_change_password).toBe(true);
  });

  it("otro contador no ve al cliente ajeno", async () => {
    const res = await handlers["accountant/clients"]({ _authHeader: `Bearer ${otherToken}` });
    expect(res.body.data.clients.map((c: { tenant_id: string }) => c.tenant_id)).toEqual(["cliente-b"]);
  });

  it("la lista de clientes exige token de contador", async () => {
    const res = await handlers["accountant/clients"]({});
    expect(res._statusCode).toBe(401);
  });

  it("el contador lista las categorías de su cliente y no las de otro", async () => {
    const own = await handlers["ledger/accountant/categories/list"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-a",
    });
    expect(own._statusCode).toBe(200);
    expect(own.body.data.categories.length).toBeGreaterThan(0);

    const other = await handlers["ledger/accountant/categories/list"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-b",
    });
    expect(other._statusCode).toBe(404);
  });
});
