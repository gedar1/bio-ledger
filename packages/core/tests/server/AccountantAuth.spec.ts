import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Db = InstanceType<typeof Database>;

describe("cuenta del contador y acceso por tenant", () => {
  let dir: string;
  let db: Db;
  let mods: {
    AccountantAuthService: typeof import("../../src/server/services/AccountantAuthService.js").AccountantAuthService;
    AccountantExistsError: typeof import("../../src/server/services/AccountantAuthService.js").AccountantExistsError;
    initializePlatformSchema: typeof import("../../src/server/services/platformSchema.js").initializePlatformSchema;
    TenantRegistryService: typeof import("../../src/server/services/TenantRegistryService.js").TenantRegistryService;
    TenantAuthService: typeof import("../../src/server/services/TenantAuthService.js").TenantAuthService;
    resolveTenantAccess: typeof import("../../src/server/middleware/requestAccess.js").resolveTenantAccess;
    buildTokenVerifier: typeof import("../../src/server/middleware/requestAccess.js").buildTokenVerifier;
  };

  beforeEach(async () => {
    // API_SECRET se lee al cargar el módulo, así que se fija antes de importar.
    vi.stubEnv("API_SECRET", "test-api-secret");
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    vi.stubEnv("DEPLOYMENT_MODE", "studio");
    vi.resetModules();

    const accountant =
      await import("../../src/server/services/AccountantAuthService.js");
    const schema = await import("../../src/server/services/platformSchema.js");
    const registry =
      await import("../../src/server/services/TenantRegistryService.js");
    const tenantAuth =
      await import("../../src/server/services/TenantAuthService.js");
    const requestAccess =
      await import("../../src/server/middleware/requestAccess.js");
    mods = {
      AccountantAuthService: accountant.AccountantAuthService,
      AccountantExistsError: accountant.AccountantExistsError,
      initializePlatformSchema: schema.initializePlatformSchema,
      TenantRegistryService: registry.TenantRegistryService,
      TenantAuthService: tenantAuth.TenantAuthService,
      resolveTenantAccess: requestAccess.resolveTenantAccess,
      buildTokenVerifier: requestAccess.buildTokenVerifier,
    };

    dir = mkdtempSync(join(tmpdir(), "accountant-"));
    db = new Database(":memory:");
    mods.initializePlatformSchema(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function setup() {
    const accountants = new mods.AccountantAuthService(db);
    const account = await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });
    const registry = new mods.TenantRegistryService(join(dir, "tenants"));
    registry.initialize(db);
    registry.create({
      tenant_id: "cliente-propio",
      display_name: "Propio",
      profile: "domain",
      owner_id: String(account.id),
    });
    registry.create({
      tenant_id: "cliente-ajeno",
      display_name: "Ajeno",
      profile: "domain",
      owner_id: "999",
    });
    const tenantAuth = new mods.TenantAuthService(registry);
    const token = accountants.issueToken(account);
    return { accountants, account, tenantAuth, token };
  }

  it("crea la cuenta y autentica con usuario y contraseña", async () => {
    const accountants = new mods.AccountantAuthService(db);
    const account = await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });

    expect(account.id).toBe(1);
    expect(
      await accountants.authenticate("contador", "clave-de-prueba-larga"),
    ).toEqual(account);
    expect(
      await accountants.authenticate("contador", "clave-incorrecta-x"),
    ).toBeNull();
    expect(
      await accountants.authenticate("otro", "clave-de-prueba-larga"),
    ).toBeNull();
  });

  it("no permite una segunda cuenta de contador", async () => {
    const accountants = new mods.AccountantAuthService(db);
    await accountants.createAccountant({
      username: "contador",
      password: "clave-de-prueba-larga",
    });

    await expect(
      accountants.createAccountant({
        username: "segundo",
        password: "clave-de-prueba-larga",
      }),
    ).rejects.toBeInstanceOf(mods.AccountantExistsError);
  });

  it("rechaza usuario con mayúsculas y contraseña corta", async () => {
    const accountants = new mods.AccountantAuthService(db);

    await expect(
      accountants.createAccountant({
        username: "Contador",
        password: "clave-de-prueba-larga",
      }),
    ).rejects.toThrow();
    await expect(
      accountants.createAccountant({ username: "contador", password: "corta" }),
    ).rejects.toThrow();
  });

  it("el token de contador solo da acceso a los tenants de su cuenta", async () => {
    const { tenantAuth, token } = await setup();
    const header = `Bearer ${token}`;

    const own = mods.resolveTenantAccess(
      { tenantId: "cliente-propio", _authHeader: header },
      tenantAuth,
    );
    expect(own).toEqual({ ok: true, tenantId: "cliente-propio" });

    const other = mods.resolveTenantAccess(
      { tenantId: "cliente-ajeno", _authHeader: header },
      tenantAuth,
    );
    expect(other.ok).toBe(false);

    const missing = mods.resolveTenantAccess(
      { _authHeader: header },
      tenantAuth,
    );
    expect(missing.ok).toBe(false);
  });

  it("la compuerta global deja pasar chat y bloquea el resto para el contador", async () => {
    const { tenantAuth, token } = await setup();
    const verify = mods.buildTokenVerifier(() => tenantAuth);
    const header = `Bearer ${token}`;

    expect(verify(header, "/api/accountant/chat")).toBe("allow");
    expect(verify(header, "/api/chat")).toBe("forbidden");
    expect(verify(header, "/api/tools")).toBe("forbidden");
    expect(verify(header, "/api/tenants")).toBe("forbidden");
  });

  it("rechaza tokens de contador falsificados", async () => {
    const { tenantAuth } = await setup();
    const verify = mods.buildTokenVerifier(() => tenantAuth);

    expect(verify("Bearer no-es-un-jwt", "/api/chat")).toBe("invalid");
  });

  it("el dueño de un tenant se compara con el id de la cuenta", async () => {
    const { tenantAuth, account } = await setup();

    expect(tenantAuth.accountOwnsTenant(account.id, "cliente-propio")).toBe(
      true,
    );
    expect(tenantAuth.accountOwnsTenant(account.id, "cliente-ajeno")).toBe(
      false,
    );
    expect(tenantAuth.accountOwnsTenant(account.id, "no-existe")).toBe(false);
  });
});
