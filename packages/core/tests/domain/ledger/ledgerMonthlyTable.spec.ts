import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpenseMolecule } from "../../../src/molecules/ExpenseMolecule.js";
import { ledgerRegistrations } from "../../../src/cells/ledgerCells.js";
import { LEDGER_CLIENT_CELL } from "../../../src/config/ledgerCellTypes.js";
import { ledgerClientProfile } from "../../../src/config/ledgerProfiles.js";
import { ChatViewSchema } from "../../../src/atoms/chatView.js";

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

/** Servidor MCP simulado: guarda los handlers de cada herramienta registrada. */
function fakeServer() {
  const handlers: Record<string, Handler> = {};
  return {
    handlers,
    server: {
      registerTool: (name: string, _config: unknown, handler: Handler) => {
        handlers[name] = handler;
      },
    },
  };
}

describe("gasto por mes como tabla", () => {
  let dir: string;
  let molecule: ExpenseMolecule;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-mes-"));
    molecule = new ExpenseMolecule(join(dir, "cliente.db"));
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    molecule.createExpense(
      {
        fecha: `${year}-03-10`,
        importe_cents: 12100,
        tasa_btw: 21,
        concepto: "Papel",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
  });

  afterEach(async () => {
    await molecule.dispose();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("la herramienta devuelve una tabla con doce meses y el total", async () => {
    const registration = ledgerRegistrations.find((r) => r.type === LEDGER_CLIENT_CELL)!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: join(dir, "cliente.db"),
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );

    const res = (await handlers["get_my_monthly_totals"]({})) as {
      structuredContent?: {
        view?: {
          type: string;
          columns: { key: string; format: string }[];
          rows: (string | number)[][];
          total?: number;
        };
      };
    };
    const view = res.structuredContent?.view;
    expect(view?.type).toBe("table");
    expect(view?.columns).toEqual([
      { key: "month", format: "month" },
      { key: "amount", format: "cents" },
    ]);
    expect(view?.rows).toHaveLength(12);
    expect(view?.rows[2]).toEqual([`${year}-03`, 12100]);
    expect(view?.total).toBe(12100);
  });

  it("el perfil del cliente declara la cadena gasto-por-mes sin datos, con vista de tabla", () => {
    const chain = ledgerClientProfile.chains?.find((c) => c.id === "gasto-por-mes");
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([]);
    expect(chain?.steps).toEqual([
      { cell: LEDGER_CLIENT_CELL, tool: "get_my_monthly_totals", args: {} },
    ]);
    expect(chain?.view).toBe("table");
    expect(chain?.respond).toBe("tool");
  });

  it("el esquema acepta la tabla mensual y ya no acepta el tipo chart", () => {
    const table = {
      type: "table",
      titleKey: "chat.viewMonthlyTitle",
      params: { year: "2025" },
      columns: [
        { key: "month", format: "month" },
        { key: "amount", format: "cents" },
      ],
      rows: [["2025-01", 0]],
      total: 0,
    };
    expect(ChatViewSchema.safeParse(table).success).toBe(true);
    expect(
      ChatViewSchema.safeParse({ ...table, type: "chart", series: [] }).success,
    ).toBe(false);
  });
});
