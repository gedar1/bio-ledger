import { describe, it, expect } from "vitest";
import {
  extractChatView,
  viewFitsDeclaration,
} from "../../src/atoms/chatView.js";

const table = {
  type: "table" as const,
  titleKey: "chat.viewCategoryTitle",
  params: { period: "2026-11" },
  columns: [
    { key: "category", format: "text" as const },
    { key: "amount", format: "cents" as const },
    { key: "count", format: "count" as const },
  ],
  rows: [["Representación", 14500, 1]],
  total: 14500,
};

const card = {
  type: "card" as const,
  titleKey: "chat.viewStatementTitle",
  params: { period: "2026-11" },
  items: [{ key: "approved", format: "cents" as const, value: 0 }],
};

describe("vista de datos del chat", () => {
  it("acepta una card con claves, formato y valores crudos", () => {
    expect(extractChatView({ structuredContent: { view: card } })).toEqual(
      card,
    );
  });

  it("acepta una tabla con importes en céntimos y total", () => {
    expect(
      extractChatView({ content: [], structuredContent: { view: table } }),
    ).toEqual(table);
  });

  it("una vista sin declarar cualquier tipo", () => {
    expect(viewFitsDeclaration(card)).toBe(true);
  });

  it("una vista solo encaja con el tipo que declara la cadena", () => {
    expect(viewFitsDeclaration(card, "card")).toBe(true);
    expect(viewFitsDeclaration(card, "table")).toBe(false);
  });

  it("devuelve null si el resultado no trae vista", () => {
    expect(
      extractChatView({ content: [{ type: "text", text: "hola" }] }),
    ).toBeNull();
    expect(extractChatView(undefined)).toBeNull();
    expect(extractChatView("texto")).toBeNull();
  });

  it("devuelve null si la vista no cumple el esquema", () => {
    expect(
      extractChatView({ structuredContent: { view: { type: "chart" } } }),
    ).toBeNull();
    expect(
      extractChatView({
        structuredContent: { view: { ...table, rows: "no" } },
      }),
    ).toBeNull();
    expect(
      extractChatView({
        structuredContent: { view: { ...table, total: "€ 145,00" } },
      }),
    ).toBeNull();
  });
});
