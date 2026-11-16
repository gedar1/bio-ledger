import { afterEach, describe, expect, it, vi } from "vitest";
import { TenantManager } from "../../src/server/TenantManager.js";
import { UnifiedCortex } from "../../src/system/implementations/UnifiedCortex.js";
import { registerDomainProfile } from "../../src/config/profileRegistry.js";
import {
  LEDGER_ACCOUNTANT_PROFILE,
  LEDGER_CLIENT_PROFILE,
  sessionKey,
} from "../../src/atoms/chatProfiles.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("sesiones por tenant y perfil", () => {
  it("sessionKey separa el perfil del tenant y deja la sesión por defecto con la clave del tenant", () => {
    expect(sessionKey("t1")).toBe("t1");
    expect(sessionKey("t1", LEDGER_CLIENT_PROFILE)).toBe("t1::ledger-cliente");
  });

  it("el cliente y el contador de un mismo tenant tienen sesiones y historiales separados", async () => {
    vi.spyOn(UnifiedCortex.prototype, "init").mockResolvedValue(undefined);
    registerDomainProfile(LEDGER_CLIENT_PROFILE, { allowedCells: ["memory"], agentFile: "config/domain-agent.md" });
    registerDomainProfile(LEDGER_ACCOUNTANT_PROFILE, { allowedCells: ["memory"], agentFile: "config/domain-agent.md" });

    const manager = new TenantManager({ maxTenants: 10 });
    const cliente = await manager.getTenant("cliente-x", LEDGER_CLIENT_PROFILE);
    const contador = await manager.getTenant("cliente-x", LEDGER_ACCOUNTANT_PROFILE);
    const porDefecto = await manager.getTenant("cliente-x");

    expect(cliente).not.toBe(contador);
    expect(cliente).not.toBe(porDefecto);
    expect(contador).not.toBe(porDefecto);
    expect(cliente.profile).toBe(LEDGER_CLIENT_PROFILE);
    expect(contador.profile).toBe(LEDGER_ACCOUNTANT_PROFILE);

    // Pedir de nuevo el mismo perfil devuelve la misma sesión, sin reiniciar el historial.
    expect(await manager.getTenant("cliente-x", LEDGER_CLIENT_PROFILE)).toBe(cliente);
  });

  it("un perfil no registrado cae en la sesión por defecto", async () => {
    vi.spyOn(UnifiedCortex.prototype, "init").mockResolvedValue(undefined);
    const manager = new TenantManager({ maxTenants: 10 });
    const porDefecto = await manager.getTenant("cliente-y");
    expect(await manager.getTenant("cliente-y", "perfil-inexistente")).toBe(porDefecto);
  });
});

describe("perfil de conversación según el token", () => {
  it("un token de contador usa el perfil del contador; sin autenticación, la sesión por defecto", async () => {
    vi.stubEnv("PLATFORM_SECRET", "test-platform-secret");
    vi.stubEnv("API_SECRET", "");
    vi.resetModules();
    const { chatProfileFor } = await import("../../src/server/middleware/requestAccess.js");

    // Sin API_SECRET la autenticación está desactivada: todos usan la sesión por defecto.
    expect(chatProfileFor({ _authHeader: "Bearer x" }, undefined)).toBeUndefined();

    vi.stubEnv("API_SECRET", "clave-de-prueba");
    vi.resetModules();
    const accountantModule = await import("../../src/server/services/AccountantAuthService.js");
    const requestModule = await import("../../src/server/middleware/requestAccess.js");
    const service = new accountantModule.AccountantAuthService({} as never);
    const token = service.issueToken({ id: 1, username: "contador" });

    expect(requestModule.chatProfileFor({ _authHeader: `Bearer ${token}` }, undefined)).toBe(LEDGER_ACCOUNTANT_PROFILE);
  });
});
