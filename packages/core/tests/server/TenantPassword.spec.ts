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
import { setupTenantPasswordRoutes } from "../../src/server/routes/TenantPasswordRoutes.js";
import { LoginRateLimiter } from "../../src/server/middleware/loginRateLimiter.js";
import { buildTokenVerifier } from "../../src/server/middleware/requestAccess.js";

type Handler = (params?: unknown) => Promise<{ _statusCode: number; body: any }>;

describe("contraseñas de cliente", () => {
  let dir: string;
  let db: InstanceType<typeof Database>;
  let registry: TenantRegistryService;
  let tenantAuth: TenantAuthService;
  let accountants: AccountantAuthService;
  let accountantToken: string;
  let otherAccountantToken: string;
  let handlers: Record<string, Handler>;

  beforeEach(async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    dir = mkdtempSync(join(tmpdir(), "tenant-pass-"));
    db = new Database(":memory:");
    initializePlatformSchema(db);

    accountants = new AccountantAuthService(db);
    const account = await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });
    accountantToken = accountants.issueToken(account);
    // Segunda cuenta solo para probar el rechazo de un tenant ajeno. Se inserta directo
    // porque el servicio solo permite una cuenta.
    db.prepare("INSERT INTO platform_accounts (username, password_hash) VALUES ('otro', 'x:y')").run();
    otherAccountantToken = accountants.issueToken({ id: 2, username: "otro" });

    registry = new TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
    tenantAuth = new TenantAuthService(registry);

    handlers = {};
    const fakeHealth = {
      registerData: (name: string, fn: Handler) => {
        handlers[name] = fn;
      },
    };
    setupAccountantTenantRoutes(fakeHealth as never, registry, tenantAuth);
    setupTenantPasswordRoutes(fakeHealth as never, tenantAuth, new LoginRateLimiter());
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function altaCliente(id: string): Promise<string> {
    const res = await handlers["accountant/tenants"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: id,
      display_name: `Cliente ${id}`,
    });
    expect(res._statusCode).toBe(201);
    expect(res.body.data.api_key).toBeUndefined();
    expect(res.body.data.must_change_password).toBe(true);
    return res.body.data.temp_password as string;
  }

  it("el alta devuelve una contraseña temporal y ya no una clave de API", async () => {
    const temp = await altaCliente("cliente-uno");
    expect(temp.length).toBeGreaterThanOrEqual(12);
  });

  it("el cliente entra con la temporal y queda obligado a cambiarla", async () => {
    const temp = await altaCliente("cliente-dos");

    const login = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-dos",
      password: temp,
    });
    expect(login._statusCode).toBe(200);
    expect(login.body.data.must_change_password).toBe(true);
    expect(login.body.data.role).toBe("operator");

    const verify = buildTokenVerifier(() => tenantAuth);
    const header = `Bearer ${login.body.data.token}`;
    expect(verify(header, "/api/chat")).toBe("password_change_required");
    expect(verify(header, "/api/tenant/auth/change-password")).toBe("allow");
  });

  it("rechaza una contraseña incorrecta", async () => {
    await altaCliente("cliente-tres");

    const res = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-tres",
      password: "contraseña-equivocada",
    });
    expect(res._statusCode).toBe(401);
  });

  it("el cambio de contraseña invalida la temporal y quita la obligación", async () => {
    const temp = await altaCliente("cliente-cuatro");
    const login = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-cuatro",
      password: temp,
    });
    const header = `Bearer ${login.body.data.token}`;

    const change = await handlers["tenant/auth/change-password"]({
      _authHeader: header,
      new_password: "nueva-clave-propia-1",
    });
    expect(change._statusCode).toBe(200);
    expect(change.body.data.token).toBeTypeOf("string");

    const oldTemp = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-cuatro",
      password: temp,
    });
    expect(oldTemp._statusCode).toBe(401);

    const nuevo = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-cuatro",
      password: "nueva-clave-propia-1",
    });
    expect(nuevo.body.data.must_change_password).toBe(false);
  });

  it("el cambio exige una contraseña de al menos 12 caracteres", async () => {
    const temp = await altaCliente("cliente-cinco");
    const login = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-cinco",
      password: temp,
    });

    const res = await handlers["tenant/auth/change-password"]({
      _authHeader: `Bearer ${login.body.data.token}`,
      new_password: "corta",
    });
    expect(res._statusCode).toBe(422);
  });

  it("el contador restablece la temporal de su cliente", async () => {
    await altaCliente("cliente-seis");

    const res = await handlers["accountant/tenants/reset-password"]({
      _authHeader: `Bearer ${accountantToken}`,
      tenant_id: "cliente-seis",
    });
    expect(res._statusCode).toBe(200);
    expect(res.body.data.must_change_password).toBe(true);

    const login = await handlers["tenant/auth/password-login"]({
      tenant_id: "cliente-seis",
      password: res.body.data.temp_password,
    });
    expect(login._statusCode).toBe(200);
  });

  it("otro contador no puede restablecer un cliente ajeno", async () => {
    await altaCliente("cliente-siete");

    const res = await handlers["accountant/tenants/reset-password"]({
      _authHeader: `Bearer ${otherAccountantToken}`,
      tenant_id: "cliente-siete",
    });
    expect(res._statusCode).toBe(404);
  });
});
