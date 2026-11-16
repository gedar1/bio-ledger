import { describe, it, expect, afterEach, vi } from "vitest";

type Req = { url: string; method: string; headers: Record<string, string> };

async function loadChecker(apiSecret: string) {
  vi.stubEnv("API_SECRET", apiSecret);
  vi.resetModules();
  return import("../../src/server/middleware/apiAuth.js");
}

const req = (url: string, headers: Record<string, string> = {}): Req => ({
  url,
  method: "POST",
  headers,
});

describe("endpoints bloqueados", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin API_SECRET, un endpoint de plataforma de escritura responde 404", async () => {
    const { checkAuth } = await loadChecker("");
    const result = checkAuth(req("/api/platform/tenants") as never);
    expect(result).toEqual({ error: "Endpoint no disponible en este despliegue", status: 404 });
  });

  it("con API_SECRET, la clave de operador tampoco entra a un endpoint bloqueado", async () => {
    const { checkAuth } = await loadChecker("clave-operador-de-prueba");
    const result = checkAuth(
      req("/api/template/execute", { authorization: "Bearer clave-operador-de-prueba" }) as never,
    );
    expect(result?.status).toBe(404);
  });

  it("sin API_SECRET, los logs siguen disponibles para diagnóstico", async () => {
    const { checkAuth } = await loadChecker("");
    expect(checkAuth({ url: "/api/logs", method: "GET", headers: {} } as never)).toBeNull();
  });

  it("el chat no está bloqueado", async () => {
    const { checkAuth } = await loadChecker("clave-operador-de-prueba");
    const result = checkAuth(
      req("/api/chat", { authorization: "Bearer clave-operador-de-prueba" }) as never,
    );
    expect(result).toBeNull();
  });

  it("las rutas de login siguen públicas", async () => {
    const { checkAuth } = await loadChecker("clave-operador-de-prueba");
    expect(checkAuth(req("/api/accountant/auth/login") as never)).toBeNull();
    expect(checkAuth(req("/api/tenant/auth/password-login") as never)).toBeNull();
  });
});
