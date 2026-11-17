import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpenseMolecule } from "../../src/molecules/ExpenseMolecule.js";
import { ledgerRegistrations, LEDGER_CLIENT_CELL, LEDGER_ACCOUNTANT_CELL } from "../../src/config/ledgerComposition.js";
import { extractToolText } from "../../src/atoms/chainResponse.js";
import { currentMonthCode } from "../../src/config/ledgerComposition.js";
import { ledgerClientProfile } from "../../src/config/ledgerProfiles.js";

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

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

describe("herramientas del chat contable", () => {
  let dir: string;
  let molecule: ExpenseMolecule;
  let categoryId: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-tools-"));
    molecule = new ExpenseMolecule(join(dir, "cliente.db"));
    await molecule.initialize();
    categoryId = molecule.listCategories()[0].id;
    const aprobado = molecule.createExpense(
      { fecha: "2025-03-10", importe_cents: 12100, tasa_btw: 21, concepto: "Papel", categoria_id: categoryId, con_soporte: true },
      "CLIENT",
    );
    molecule.decideExpense(aprobado.id, "APROBADO", "contador");
    molecule.createExpense(
      { fecha: "2025-03-12", importe_cents: 900, tasa_btw: 0, concepto: "Taxi", categoria_id: categoryId },
      "CLIENT",
    );
  });

  afterEach(async () => {
    await molecule.dispose();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function contextFor(key: string) {
    return {
      tenantDbPath: join(dir, "cliente.db"),
      getResource: () => molecule,
      trackResource: () => undefined,
      key,
    };
  }

  function registerCell(type: string) {
    const registration = ledgerRegistrations.find((r) => r.type === type);
    if (!registration) throw new Error("registro no encontrado: " + type);
    const { handlers, server } = fakeServer();
    registration.registerTools(server as never, contextFor(type) as never);
    return handlers;
  }

  it("el cliente lista sus gastos con formato fijo por código", async () => {
    const handlers = registerCell(LEDGER_CLIENT_CELL);
    const res = await handlers["list_my_expenses"]({});
    const text = res.content[0].text;

    expect(text).toContain("2 gasto(s):");
    expect(text).toContain("Papel");
    expect(text).toContain("121,00");
    expect(text).toContain("aprobado");
    expect(text).toContain("pendiente");
  });

  it("el filtro por estado devuelve solo ese estado", async () => {
    const handlers = registerCell(LEDGER_CLIENT_CELL);
    const res = await handlers["list_my_expenses"]({ estado: "APROBADO" });
    expect(res.content[0].text).toContain("1 gasto(s):");
    expect(res.content[0].text).not.toContain("Taxi");
  });

  it("el estado de cuenta del cliente no muestra deducible", async () => {
    const handlers = registerCell(LEDGER_CLIENT_CELL);
    const res = await handlers["get_my_statement"]({ periodo: "2025-03" });
    const text = res.content[0].text;

    expect(text).toContain("Aprobados:");
    expect(text).toContain("Pendientes:");
    expect(text).not.toContain("Deducible");
    expect(text).not.toContain("Sin soporte");
  });

  it("el estado de cuenta del contador sí muestra deducible y sin soporte", async () => {
    const handlers = registerCell(LEDGER_ACCOUNTANT_CELL);
    const res = await handlers["get_client_statement"]({ periodo: "2025-03" });
    expect(res.content[0].text).toContain("Deducible:");
    expect(res.content[0].text).toContain("Sin soporte:");
  });

  it("un periodo inválido responde con un mensaje, no con un error", async () => {
    const handlers = registerCell(LEDGER_CLIENT_CELL);
    const res = await handlers["get_my_statement"]({ periodo: "2025-13" });
    expect(res.content[0].text).toContain("Periodo no válido");
  });

  it("el contador lista pendientes del cliente seleccionado", async () => {
    const handlers = registerCell(LEDGER_ACCOUNTANT_CELL);
    const res = await handlers["list_pending_expenses"]({});
    expect(res.content[0].text).toContain("Taxi");
    expect(res.content[0].text).not.toContain("Papel");
  });
});

describe("estado de cuenta del mes actual", () => {
  it("el código del mes sale en formato AAAA-MM", () => {
    expect(currentMonthCode(new Date(2026, 10, 16))).toBe("2026-11");
    expect(currentMonthCode(new Date(2026, 0, 3))).toBe("2026-01");
  });

  it("la herramienta sin periodo responde el mes actual", async () => {
    const molecule = new ExpenseMolecule(join(tmpdir(), "month-" + Date.now() + ".db"));
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    molecule.createExpense(
      { fecha: currentMonthCode() + "-05", importe_cents: 2400, tasa_btw: 21, concepto: "Del mes", categoria_id: categoryId, con_soporte: true },
      "CLIENT",
    );
    const registration = ledgerRegistrations.find((r) => r.type === LEDGER_CLIENT_CELL)!;
    const { handlers, server } = fakeServer();
    registration.registerTools(server as never, {
      tenantDbPath: "unused",
      getResource: () => molecule,
      trackResource: () => undefined,
    } as never);
    const res = await handlers["get_my_month_statement"]({});
    await molecule.dispose();
    expect(res.content[0].text).toContain("Estado de cuenta " + currentMonthCode());
    expect(res.content[0].text).not.toContain("Deducible");
  });

  it("el perfil del cliente declara la cadena del mes actual sin datos", () => {
    const chain = ledgerClientProfile.chains?.find((c) => c.id === "estado-de-cuenta-mes");
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([]);
    expect(chain?.steps).toEqual([{ cell: LEDGER_CLIENT_CELL, tool: "get_my_month_statement", args: {} }]);
    expect(chain?.respond).toBe("tool");
  });
});

describe("texto de respuesta de una cadena", () => {
  it("toma el texto del contenido MCP", () => {
    expect(extractToolText({ content: [{ type: "text", text: "Hola" }] })).toBe("Hola");
  });

  it("acepta un texto directo", () => {
    expect(extractToolText("Listo")).toBe("Listo");
  });

  it("devuelve null si no hay texto", () => {
    expect(extractToolText({ content: [] })).toBeNull();
    expect(extractToolText(undefined)).toBeNull();
    expect(extractToolText("   ")).toBeNull();
  });
});
