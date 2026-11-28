import { describe, it, expect } from "vitest";
import { tenantProfileProblem } from "../../src/atoms/startupGuard.js";

describe("TENANT_PROFILE al arrancar", () => {
  it("exige que TENANT_PROFILE esté definido", () => {
    expect(tenantProfileProblem(undefined, ["ledger"])).toContain("obligatorio");
    expect(tenantProfileProblem("", ["ledger"])).toContain("obligatorio");
  });

  it("exige que el perfil esté registrado", () => {
    expect(tenantProfileProblem("domain", ["ledger"])).toContain("no está registrado");
  });

  it("acepta un perfil registrado", () => {
    expect(tenantProfileProblem("ledger", ["ledger", "ledger-cliente"])).toBeNull();
  });
});
