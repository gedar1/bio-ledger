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

type Handler = (params?: unknown) => Promise<{ _statusCode: number; body: any }>;

describe("POST accountant/tenants", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let registry: TenantRegistryService;
  let handler: Handler;
  let token: string;
  let accountId: number;

  beforeEach(async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    dir = mkdtempSync(join(tmpdir(), "acc-tenants-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);

    const accountants = new AccountantAuthService(db);
    const account = await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });
    accountId = account.id;
    token = accountants.issueToken(account);

    registry = new TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
    const tenantAuth = new TenantAuthService(registry);

    const handlers: Record<string, Handler> = {};
    const fakeHealth = {
      registerData: (name: string, fn: Handler) => {
        handlers[name] = fn;
      },
    };
    setupAccountantTenantRoutes(fakeHealth as never, registry, tenantAuth);
    handler = handlers["accountant/tenants"];
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("crea el cliente con el dueño del token y devuelve una contraseña temporal", async () => {
    const res = await handler({
      _authHeader: `Bearer ${token}`,
      tenant_id: "cliente-uno",
      display_name: "Cliente Uno",
      owner_id: "999",
    });

    expect(res._statusCode).toBe(201);
    expect(res.body.data.owner_id).toBe(String(accountId));
    expect(typeof res.body.data.temp_password).toBe("string");
    expect(res.body.data.api_key).toBeUndefined();
    expect(registry.getById("cliente-uno")?.owner_id).toBe(String(accountId));
  });

  it("rechaza la petición sin token de contador", async () => {
    const res = await handler({ tenant_id: "cliente-dos", display_name: "Dos" });

    expect(res._statusCode).toBe(401);
    expect(registry.exists("cliente-dos")).toBe(false);
  });

  it("rechaza un tenant_id que ya existe", async () => {
    const params = {
      _authHeader: `Bearer ${token}`,
      tenant_id: "cliente-tres",
      display_name: "Tres",
    };
    await handler(params);

    const res = await handler(params);
    expect(res._statusCode).toBe(409);
  });
});
