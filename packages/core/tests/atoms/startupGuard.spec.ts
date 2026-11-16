import { describe, it, expect } from "vitest";
import { openApiProblem } from "../../src/atoms/startupGuard.js";

describe("arranque con API abierta", () => {
  it("studio sin API_SECRET no arranca", () => {
    expect(openApiProblem({ deploymentMode: "studio", authEnabled: false, allowOpenApi: false })).toContain(
      "requiere API_SECRET",
    );
  });

  it("studio con API_SECRET arranca", () => {
    expect(openApiProblem({ deploymentMode: "studio", authEnabled: true, allowOpenApi: false })).toBeNull();
  });

  it("studio sin API_SECRET arranca solo con ALLOW_OPEN_API=true", () => {
    expect(openApiProblem({ deploymentMode: "studio", authEnabled: false, allowOpenApi: true })).toBeNull();
  });

  it("single no se afecta", () => {
    expect(openApiProblem({ deploymentMode: "single", authEnabled: false, allowOpenApi: false })).toBeNull();
  });
});
