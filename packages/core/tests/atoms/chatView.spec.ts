import { describe, it, expect } from "vitest";
import { extractChatView, viewFitsDeclaration } from "../../src/atoms/chatView.js";

const view = {
  type: "table" as const,
  title: "Gasto por categoría, 2026-11",
  columns: ["Categoría", "Importe", "Gastos"],
  rows: [["Representación", "€ 145,00", "1"]],
  total: "€ 145,00",
};

const card = { type: "card" as const, title: "Estado de cuenta 2026-11", items: [{ label: "Aprobados", value: "€ 0,00" }] };

describe("vista de datos del chat", () => {
  it("acepta una card con pares etiqueta-valor", () => {
    expect(extractChatView({ structuredContent: { view: card } })).toEqual(card);
  });

  it("una vista sin declarar cualquier tipo", () => {
    expect(viewFitsDeclaration(card)).toBe(true);
  });

  it("una vista solo encaja con el tipo que declara la cadena", () => {
    expect(viewFitsDeclaration(card, "card")).toBe(true);
    expect(viewFitsDeclaration(card, "table")).toBe(false);
  });

  it("saca la vista de un resultado de herramienta que la trae", () => {
    expect(extractChatView({ content: [], structuredContent: { view } })).toEqual(view);
  });

  it("devuelve null si el resultado no trae vista", () => {
    expect(extractChatView({ content: [{ type: "text", text: "hola" }] })).toBeNull();
    expect(extractChatView(undefined)).toBeNull();
    expect(extractChatView("texto")).toBeNull();
  });

  it("devuelve null si la vista no cumple el esquema", () => {
    expect(extractChatView({ structuredContent: { view: { type: "chart" } } })).toBeNull();
    expect(extractChatView({ structuredContent: { view: { ...view, rows: "no" } } })).toBeNull();
  });
});
