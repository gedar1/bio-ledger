import { describe, it, expect } from "vitest";
import { ledgerClientProfile } from "../../src/config/ledgerProfiles.js";
import { LEDGER_CLIENT_CELL } from "../../src/config/ledgerCellTypes.js";

describe("cadena gastos-por-estado", () => {
  const chain = ledgerClientProfile.chains?.find((c) => c.id === "gastos-por-estado");

  it("pide el estado con el extractor estado", () => {
    expect(chain?.requires).toEqual([
      {
        name: "estado",
        extractor: "estado",
        ask: "¿Qué estado quieres ver: aprobados, pendientes, rechazados o anulados?",
      },
    ]);
  });

  it("llama a list_my_expenses con el estado extraído, sin modelo", () => {
    expect(chain?.steps).toEqual([
      { cell: LEDGER_CLIENT_CELL, tool: "list_my_expenses", args: { estado: "$requires.estado" } },
    ]);
    expect(chain?.respond).toBe("tool");
  });

  it("va después de mis-gastos para que la guarda la deje pasar cuando hay estado", () => {
    const ids = ledgerClientProfile.chains?.map((c) => c.id) ?? [];
    expect(ids.indexOf("gastos-por-estado")).toBeGreaterThan(ids.indexOf("mis-gastos"));
  });
});
