import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolveCellServerPath } from "../../src/organisms/BaseOrganisms.js";

describe("proceso MCP de las células", () => {
  const base = join("dist", "organisms");

  it("usa la composición del dominio si application-cell.js existe", () => {
    const path = resolveCellServerPath(base, (candidate) => candidate.endsWith("application-cell.js"));
    expect(path).toBe(join(base, "..", "application-cell.js"));
  });

  it("usa el motor genérico si no hay composición del dominio", () => {
    const path = resolveCellServerPath(base, () => false);
    expect(path).toBe(join(base, "..", "cells", "CellServer.js"));
  });
});
