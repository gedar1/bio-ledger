import { describe, it, expect } from "vitest";
import { filterRedundantMutationTool, MUTATION_TOOL } from "../../src/atoms/redundantMutation.js";

const tools = [{ name: "get_my_statement" }, { name: MUTATION_TOOL }];

describe("filtro de la herramienta de mutación", () => {
  it("la quita cuando todas las células permitidas ya están mutadas", () => {
    const result = filterRedundantMutationTool(tools, ["ledger_cliente"], new Set(["ledger_cliente"]));
    expect(result.map((t) => t.name)).toEqual(["get_my_statement"]);
  });

  it("la conserva si alguna célula permitida aún no está mutada", () => {
    const result = filterRedundantMutationTool(
      tools,
      ["ledger_cliente", "memory"],
      new Set(["ledger_cliente"]),
    );
    expect(result).toEqual(tools);
  });

  it("la conserva si no hay mutaciones todavía", () => {
    expect(filterRedundantMutationTool(tools, ["ledger_cliente"], new Set())).toEqual(tools);
  });

  it("sin células permitidas no la quita, porque no hay nada mutado que compare", () => {
    expect(filterRedundantMutationTool(tools, [], new Set(["ledger_cliente"]))).toEqual(tools);
  });
});
