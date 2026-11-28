import { describe, it, expect } from "vitest";
import { buildJevToolCatalog, mergeToolDescriptions } from "../../src/config/toolCatalog.js";
import { BioCoreError } from "../../src/errors.js";

describe("catálogo de Jev", () => {
  it("una célula del producto ve sus herramientas y no las del motor", () => {
    const catalog = buildJevToolCatalog(["ledger_cliente"]);
    expect(catalog).toHaveProperty("list_my_expenses");
    expect(catalog).toHaveProperty("get_my_largest_expense");
    expect(catalog).not.toHaveProperty("db_insert");
  });

  it("la célula de memoria ve las herramientas del motor y no las del producto", () => {
    const catalog = buildJevToolCatalog(["memory"]);
    expect(catalog).toHaveProperty("db_insert");
    expect(catalog).not.toHaveProperty("list_my_expenses");
  });

  it("el contador ve sus herramientas de revisión", () => {
    const catalog = buildJevToolCatalog(["ledger_contador"]);
    expect(catalog).toHaveProperty("list_pending_expenses");
    expect(catalog).not.toHaveProperty("list_my_expenses");
  });
});

describe("mergeToolDescriptions", () => {
  it("une los archivos sin perder entradas", () => {
    const merged = mergeToolDescriptions([{ a: "uno" }, { b: "dos" }]);
    expect(merged).toEqual({ a: "uno", b: "dos" });
  });

  it("falla si una herramienta aparece en dos archivos", () => {
    expect(() => mergeToolDescriptions([{ a: "uno" }, { a: "otra" }])).toThrow(BioCoreError);
  });
});
