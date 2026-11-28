import { describe, it, expect } from "vitest";
import { ledgerAccountantProfile } from "../../src/config/ledgerProfiles.js";
import { LEDGER_ACCOUNTANT_CELL } from "../../src/config/ledgerCellTypes.js";

describe("cadena gastos-de-cliente", () => {
  const chain = ledgerAccountantProfile.chains?.find((c) => c.id === "gastos-de-cliente");

  it("pide el cliente y deja el periodo y el estado como opcionales", () => {
    expect(chain?.requires.map((r) => [r.name, r.extractor, !!r.optional])).toEqual([
      ["cliente", "cliente", false],
      ["periodo", "periodo", true],
      ["estado", "estado", true],
    ]);
  });

  it("llama a list_client_expenses con los tres datos, sin modelo", () => {
    expect(chain?.steps).toEqual([
      {
        cell: LEDGER_ACCOUNTANT_CELL,
        tool: "list_client_expenses",
        args: { tenantId: "$requires.cliente", periodo: "$requires.periodo", estado: "$requires.estado" },
      },
    ]);
    expect(chain?.respond).toBe("tool");
    expect(chain?.view).toBe("table");
  });
});
