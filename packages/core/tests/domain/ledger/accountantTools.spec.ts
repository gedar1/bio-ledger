import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpenseMolecule } from "../../../src/molecules/ExpenseMolecule.js";
import { ledgerRegistrations } from "../../../src/cells/ledgerCells.js";
import { LEDGER_ACCOUNTANT_CELL } from "../../../src/config/ledgerCellTypes.js";

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

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

describe("herramientas del contador por tenantId", () => {
  let dir: string;
  let sessionDb: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-contador-"));
    sessionDb = join(dir, "contador-1.db");
    // Base del cliente "cliente-235" con un gasto pendiente.
    const client = new ExpenseMolecule(join(dir, "cliente-235.db"));
    await client.initialize();
    const categoryId = client.listCategories()[0].id;
    client.createExpense(
      {
        fecha: "2025-03-10",
        importe_cents: 4500,
        tasa_btw: 21,
        concepto: "Taxi",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
    await client.dispose();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function registerAccountantTools() {
    const registration = ledgerRegistrations.find((r) => r.type === LEDGER_ACCOUNTANT_CELL)!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: sessionDb,
        getResource: () => undefined,
        trackResource: () => undefined,
      } as never,
    );
    return handlers;
  }

  it("lista los pendientes del cliente indicado, leyendo su propia base", async () => {
    const handlers = registerAccountantTools();
    const res = await handlers["list_pending_expenses"]({ tenantId: "cliente-235" });
    expect(res.content[0].text).toContain("Taxi");
  });

  it("los pendientes se devuelven también como tabla", async () => {
    const handlers = registerAccountantTools();
    const res = (await handlers["list_pending_expenses"]({ tenantId: "cliente-235" })) as {
      structuredContent?: { view?: { type: string; titleKey: string; rows: unknown[][] } };
    };
    expect(res.structuredContent?.view?.type).toBe("table");
    expect(res.structuredContent?.view?.titleKey).toBe("chat.viewPendingTitle");
    expect(res.structuredContent?.view?.rows).toHaveLength(1);
  });

  it("un cliente sin gastos responde que no hay pendientes, sin tocar otra base", async () => {
    const handlers = registerAccountantTools();
    const res = await handlers["list_pending_expenses"]({ tenantId: "cliente-nuevo" });
    expect(res.content[0].text).toBe("No hay gastos pendientes.");
  });

  it("rechaza un tenantId con caracteres de ruta", async () => {
    const handlers = registerAccountantTools();
    await expect(handlers["list_pending_expenses"]({ tenantId: "../otra" })).rejects.toThrow();
  });

  it("el estado de cuenta usa el tenantId indicado", async () => {
    const handlers = registerAccountantTools();
    const res = await handlers["get_client_statement"]({
      tenantId: "cliente-235",
      periodo: "2025-03",
    });
    expect(res.content[0].text).toContain("45");
  });
});
