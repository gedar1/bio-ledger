import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpenseMolecule } from "../../../src/molecules/ExpenseMolecule.js";
import {
  ledgerRegistrations,
  LEDGER_CLIENT_CELL,
  LEDGER_ACCOUNTANT_CELL,
} from "../../../src/domain/ledger/ledgerComposition.js";
import { extractToolText } from "../../../src/atoms/chainResponse.js";
import { currentMonthCode } from "../../../src/domain/ledger/ledgerComposition.js";
import { ledgerClientProfile } from "../../../src/config/ledgerProfiles.js";

type Handler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }> }>;

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
      {
        fecha: "2025-03-10",
        importe_cents: 12100,
        tasa_btw: 21,
        concepto: "Papel",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
    molecule.decideExpense(aprobado.id, "APROBADO", "contador");
    molecule.createExpense(
      {
        fecha: "2025-03-12",
        importe_cents: 900,
        tasa_btw: 0,
        concepto: "Taxi",
        categoria_id: categoryId,
      },
      "CLIENT",
    );
  });

  afterEach(async () => {
    await molecule.dispose();
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
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

  it("el cliente lista sus categorías como líneas de texto", async () => {
    const handlers = registerCell(LEDGER_CLIENT_CELL);
    const res = await handlers["list_my_categories"]({});
    const nombre = molecule.listCategories()[0].nombre;

    expect(res.content[0].text).toContain(`- ${nombre}`);
  });
});

describe("estado de cuenta del mes actual", () => {
  it("el código del mes sale en formato AAAA-MM", () => {
    expect(currentMonthCode(new Date(2026, 10, 16))).toBe("2026-11");
    expect(currentMonthCode(new Date(2026, 0, 3))).toBe("2026-01");
  });

  it("la herramienta sin periodo responde el mes actual", async () => {
    const molecule = new ExpenseMolecule(
      join(tmpdir(), "month-" + Date.now() + ".db"),
    );
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    molecule.createExpense(
      {
        fecha: currentMonthCode() + "-05",
        importe_cents: 2400,
        tasa_btw: 21,
        concepto: "Del mes",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
    const registration = ledgerRegistrations.find(
      (r) => r.type === LEDGER_CLIENT_CELL,
    )!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: "unused",
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );
    const res = await handlers["get_my_month_statement"]({});
    await molecule.dispose();
    expect(res.content[0].text).toContain(
      "Estado de cuenta " + currentMonthCode(),
    );
    expect(res.content[0].text).not.toContain("Deducible");
  });

  it("el perfil del cliente declara la cadena del mes actual sin datos", () => {
    const chain = ledgerClientProfile.chains?.find(
      (c) => c.id === "estado-de-cuenta-mes",
    );
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([]);
    expect(chain?.steps).toEqual([
      { cell: LEDGER_CLIENT_CELL, tool: "get_my_month_statement", args: {} },
    ]);
    expect(chain?.respond).toBe("tool");
  });
});

describe("gasto del cliente por categoría", () => {
  let dir: string;
  let molecule: ExpenseMolecule;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-categorias-"));
    molecule = new ExpenseMolecule(join(dir, "cliente.db"));
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    const aprobado = molecule.createExpense(
      {
        fecha: "2025-03-10",
        importe_cents: 12100,
        tasa_btw: 21,
        concepto: "Papel",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
    molecule.decideExpense(aprobado.id, "APROBADO", "contador");
    molecule.createExpense(
      {
        fecha: "2025-03-12",
        importe_cents: 900,
        tasa_btw: 0,
        concepto: "Taxi",
        categoria_id: categoryId,
      },
      "CLIENT",
    );
  });

  afterEach(async () => {
    await molecule.dispose();
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });

  it("suma aprobados y pendientes del periodo pedido y da el total", async () => {
    const registration = ledgerRegistrations.find(
      (r) => r.type === LEDGER_CLIENT_CELL,
    )!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: join(dir, "cliente.db"),
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );
    const res = await handlers["get_my_category_totals"]({
      periodo: "2025-03",
    });
    const text = res.content[0].text;

    expect(text).toContain("Gastos de 2025-03 por categoría");
    expect(text).toContain("(aprobados y pendientes)");
    expect(text).toContain("Total: ");
    expect(text).toContain("(2 gasto(s))");
    expect(text).toContain("130,00");
  });

  it("un periodo sin gastos responde que no hay gastos", async () => {
    const registration = ledgerRegistrations.find(
      (r) => r.type === LEDGER_CLIENT_CELL,
    )!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: join(dir, "cliente.db"),
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );
    const res = await handlers["get_my_category_totals"]({
      periodo: "2019-01",
    });
    expect(res.content[0].text).toBe("No hay gastos en 2019-01.");
  });
});

describe("cadena de categorías del cliente", () => {
  it("el perfil del cliente declara la cadena de categorías sin datos", () => {
    const chain = ledgerClientProfile.chains?.find(
      (c) => c.id === "mis-categorias",
    );
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([]);
    expect(chain?.steps).toEqual([
      { cell: LEDGER_CLIENT_CELL, tool: "list_my_categories", args: {} },
    ]);
    expect(chain?.respond).toBe("tool");
  });

  it("ya no hay cadena separada para el mes: el mes actual pasa por la cadena de periodo", () => {
    const chain = ledgerClientProfile.chains?.find(
      (c) => c.id === "gasto-por-categoria-mes",
    );
    expect(chain).toBeUndefined();
  });

  it("el perfil del cliente declara la cadena de gasto por categoría con un periodo", () => {
    const chain = ledgerClientProfile.chains?.find(
      (c) => c.id === "gasto-por-categoria-periodo",
    );
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([
      {
        name: "periodo",
        extractor: "periodo",
        ask: "¿De qué mes o trimestre quieres el gasto por categoría?",
      },
    ]);
    expect(chain?.steps).toEqual([
      {
        cell: LEDGER_CLIENT_CELL,
        tool: "get_my_category_totals",
        args: { periodo: "$requires.periodo" },
      },
    ]);
    expect(chain?.respond).toBe("tool");
  });
});

describe("gasto más caro del cliente", () => {
  let dir: string;
  let molecule: ExpenseMolecule;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-mas-caro-"));
    molecule = new ExpenseMolecule(join(dir, "cliente.db"));
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    const aprobado = molecule.createExpense(
      {
        fecha: "2025-03-10",
        importe_cents: 12100,
        tasa_btw: 21,
        concepto: "Papel",
        categoria_id: categoryId,
        con_soporte: true,
      },
      "CLIENT",
    );
    molecule.decideExpense(aprobado.id, "APROBADO", "contador");
    molecule.createExpense(
      {
        fecha: "2025-03-12",
        importe_cents: 900,
        tasa_btw: 0,
        concepto: "Taxi",
        categoria_id: categoryId,
      },
      "CLIENT",
    );
  });

  afterEach(async () => {
    await molecule.dispose();
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });

  function handlerFor(name: string) {
    const registration = ledgerRegistrations.find(
      (r) => r.type === LEDGER_CLIENT_CELL,
    )!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: join(dir, "cliente.db"),
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );
    return handlers[name];
  }

  it("devuelve el gasto de mayor importe del periodo con su línea de formato fijo", async () => {
    const res = await handlerFor("get_my_largest_expense")({
      periodo: "2025-03",
    });
    const text = res.content[0].text;

    expect(text).toContain("Gasto más caro de 2025-03:");
    expect(text).toContain("Papel");
    expect(text).not.toContain("Taxi");
  });

  it("un periodo sin gastos responde que no hay gastos", async () => {
    const res = await handlerFor("get_my_largest_expense")({
      periodo: "2019-01",
    });
    expect(res.content[0].text).toBe("No hay gastos en 2019-01.");
  });

  it("el perfil del cliente declara la cadena con periodo obligatorio", () => {
    const chain = ledgerClientProfile.chains?.find(
      (c) => c.id === "gasto-mas-caro",
    );
    expect(chain).toBeDefined();
    expect(chain?.requires).toEqual([
      {
        name: "periodo",
        extractor: "periodo",
        ask: "¿De qué mes o trimestre quieres saber tu gasto más caro?",
      },
    ]);
    expect(chain?.steps).toEqual([
      {
        cell: LEDGER_CLIENT_CELL,
        tool: "get_my_largest_expense",
        args: { periodo: "$requires.periodo" },
      },
    ]);
    expect(chain?.respond).toBe("tool");
  });
});

describe("vista de tabla de gasto por categoría", () => {
  let dir: string;
  let molecule: ExpenseMolecule;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ledger-vista-"));
    molecule = new ExpenseMolecule(join(dir, "cliente.db"));
    await molecule.initialize();
    const categoryId = molecule.listCategories()[0].id;
    molecule.createExpense(
      {
        fecha: "2025-03-10",
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
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });

  it("la herramienta devuelve la tabla con importes ya formateados y el total", async () => {
    const registration = ledgerRegistrations.find(
      (r) => r.type === LEDGER_CLIENT_CELL,
    )!;
    const { handlers, server } = fakeServer();
    registration.registerTools(
      server as never,
      {
        tenantDbPath: join(dir, "cliente.db"),
        getResource: () => molecule,
        trackResource: () => undefined,
      } as never,
    );
    const res = (await handlers["get_my_category_totals"]({
      periodo: "2025-03",
    })) as {
      structuredContent?: {
        view?: { columns: string[]; rows: string[][]; total?: string };
      };
    };
    const view = res.structuredContent?.view;

    expect(view?.columns).toEqual(["Categoría", "Importe", "Gastos"]);
    expect(view?.rows[0][1]).toContain("121,00");
    expect(view?.rows[0][2]).toBe("1");
    expect(view?.total).toContain("121,00");
  });
});

describe("vista del estado de cuenta del mes", () => {
  it("la herramienta del estado del mes devuelve una card con aprobados, pendientes y anulados", async () => {
    const molecule = new ExpenseMolecule(join(tmpdir(), "card-" + Date.now() + ".db"));
    await molecule.initialize();
    const registration = ledgerRegistrations.find((r) => r.type === LEDGER_CLIENT_CELL)!;
    const { handlers, server } = fakeServer();
    registration.registerTools(server as never, {
      tenantDbPath: "unused",
      getResource: () => molecule,
      trackResource: () => undefined,
    } as never);
    const res = (await handlers["get_my_month_statement"]({})) as {
      structuredContent?: { view?: { type: string; items: { label: string }[] } };
    };
    await molecule.dispose();

    expect(res.structuredContent?.view?.type).toBe("card");
    expect(res.structuredContent?.view?.items.map((i) => i.label)).toEqual(["Aprobados", "Pendientes", "Anulados"]);
  });
});

describe("tipo de vista declarado por las cadenas", () => {
  it("la cadena de categorías declara tabla y la del mes declara card", () => {
    const byId = (id: string) => ledgerClientProfile.chains?.find((c) => c.id === id);
    expect(byId("gasto-por-categoria-periodo")?.view).toBe("table");
    expect(byId("estado-de-cuenta-mes")?.view).toBe("card");
  });
});

describe("texto de respuesta de una cadena", () => {
  it("toma el texto del contenido MCP", () => {
    expect(extractToolText({ content: [{ type: "text", text: "Hola" }] })).toBe(
      "Hola",
    );
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
