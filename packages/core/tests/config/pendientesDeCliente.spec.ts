import { describe, it, expect } from "vitest";
import { ledgerAccountantProfile } from "../../src/config/ledgerProfiles.js";
import { LEDGER_ACCOUNTANT_CELL } from "../../src/config/ledgerCellTypes.js";

describe("cadena pendientes-de-cliente", () => {
  const chain = ledgerAccountantProfile.chains?.find(
    (c) => c.id === "pendientes-de-cliente",
  );

  it("pide el cliente con el extractor cliente", () => {
    expect(chain?.requires).toEqual([
      {
        name: "cliente",
        extractor: "cliente",
        ask: "¿De qué cliente? Dame su nombre completo o su ID.",
        retry:
          "No encuentro ese cliente en tu cuenta. Dame su nombre completo o su ID tal como aparece en la lista de clientes.",
      },
    ]);
  });

  it("llama a list_pending_expenses con el tenantId del cliente, sin modelo", () => {
    expect(chain?.steps).toEqual([
      {
        cell: LEDGER_ACCOUNTANT_CELL,
        tool: "list_pending_expenses",
        args: { tenantId: "$requires.cliente" },
      },
    ]);
    expect(chain?.respond).toBe("tool");
    expect(chain?.view).toBe("table");
  });
});
