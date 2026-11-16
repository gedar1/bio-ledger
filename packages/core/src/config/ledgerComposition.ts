import { z } from "zod";
import { ToolExecutionError } from "../errors.js";
import {
  ExpenseMolecule,
  type Expense,
} from "../molecules/ExpenseMolecule.js";
import { buildStatement, parsePeriod, type Statement } from "../atoms/statement.js";
import type {
  CellComposition,
  CellRuntimeContext,
} from "../cells/CellComposition.js";

type Registration = NonNullable<CellComposition["registrations"]>[number];

/** Tipos de célula del producto contable. Los nombres coinciden con domain-registry.json. */
export const LEDGER_CLIENT_CELL = "ledger_cliente";
export const LEDGER_ACCOUNTANT_CELL = "ledger_contador";

const ESTADOS = ["PENDIENTE", "APROBADO", "RECHAZADO", "ANULADO"] as const;
const ESTADO_TEXTO: Record<(typeof ESTADOS)[number], string> = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  ANULADO: "anulado",
};

const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const formatCents = (cents: number): string => eur.format(cents / 100);

const PERIODO = z
  .string()
  .regex(/^(\d{4}-\d{2}|\d{4}-T[1-4])$/, "periodo: AAAA-MM o AAAA-Tn")
  .describe("Periodo: AAAA-MM para un mes o AAAA-T1 a AAAA-T4 para un trimestre");

function moleculeFor(context: CellRuntimeContext, key: string): ExpenseMolecule {
  const molecule = context.getResource<ExpenseMolecule>(key);
  if (!molecule) {
    throw new ToolExecutionError(key, "La base de gastos no está inicializada.");
  }
  return molecule;
}

/** Una línea por gasto. Formato fijo por código; el modelo solo lo presenta. */
function formatExpenseLine(e: Expense, categoryName: string): string {
  const detalle = e.nota_rechazo ?? e.nota_anulacion;
  const sufijo = detalle ? ` (${detalle})` : "";
  return `${e.fecha} · ${e.concepto} · ${categoryName} · ${formatCents(e.importe_cents)} · ${ESTADO_TEXTO[e.estado]}${sufijo}`;
}

function formatExpenses(expenses: Expense[], categoryNames: Map<number, string>, empty: string): string {
  if (expenses.length === 0) return empty;
  const lines = expenses.map((e) => formatExpenseLine(e, categoryNames.get(e.categoria_id) ?? "Sin categoría"));
  return `${expenses.length} gasto(s):\n${lines.join("\n")}`;
}

/** Resumen del estado de cuenta. El deducible solo se muestra al contador. */
function formatStatement(statement: Statement, verRevision: boolean): string {
  const a = statement.aprobados;
  const lineas = [
    `Estado de cuenta ${statement.periodo} (${statement.desde} a ${statement.hasta}), en EUR.`,
    `Aprobados: ${formatCents(a.total_cents)} en ${a.cantidad} gasto(s).`,
    `Pendientes: ${formatCents(statement.pendientes.total_cents)} en ${statement.pendientes.cantidad} gasto(s).`,
    `Anulados: ${formatCents(statement.anulados.total_cents)} en ${statement.anulados.cantidad} gasto(s), no suman.`,
  ];
  if (a.por_categoria.length > 0) {
    lineas.push("Por categoría:");
    for (const c of a.por_categoria) lineas.push(`- ${c.nombre}: ${formatCents(c.total_cents)}`);
  }
  if (a.por_tasa_btw.length > 0) {
    lineas.push("Por tasa de BTW (base, BTW, total):");
    for (const r of a.por_tasa_btw) {
      lineas.push(`- ${r.tasa}%: ${formatCents(r.base_cents)}, ${formatCents(r.btw_cents)}, ${formatCents(r.total_cents)}`);
    }
  }
  if (verRevision) {
    lineas.push(`Deducible: ${formatCents(a.deducible_cents)}.`);
    lineas.push(`Sin soporte: ${formatCents(a.sin_soporte_cents)}.`);
  }
  return lineas.join("\n");
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Registro de las células de lectura del producto. Solo leen; nunca escriben. */
export const ledgerRegistrations: Registration[] = [
  {
    type: LEDGER_CLIENT_CELL,
    factory: (context) => {
      const resource = { key: LEDGER_CLIENT_CELL, molecule: new ExpenseMolecule(context.tenantDbPath) };
      context.trackResource(resource);
      return [resource];
    },
    registerTools: (server, context) => {
      const categoryNames = () =>
        new Map(moleculeFor(context, LEDGER_CLIENT_CELL).listCategories().map((c) => [c.id, c.nombre]));

      server.registerTool(
        "list_my_expenses",
        {
          description: "Lista los gastos del cliente. Filtro opcional por estado.",
          inputSchema: {
            estado: z.enum(ESTADOS).optional().describe("Solo gastos en este estado. Omitir para todos"),
          },
        },
        async ({ estado }) => {
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const expenses = molecule.listExpenses(estado);
          return textResult(formatExpenses(expenses, categoryNames(), "No hay gastos registrados."));
        },
      );

      server.registerTool(
        "get_my_statement",
        {
          description: "Estado de cuenta del cliente para un periodo. Sin columna de deducible.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult("Periodo no válido. Usa AAAA-MM o AAAA-Tn.");
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          return textResult(formatStatement(buildStatement(period, molecule.listExpenses(), molecule.listCategories()), false));
        },
      );

      server.registerTool(
        "list_my_categories",
        {
          description: "Lista las categorías de gasto disponibles para el cliente.",
          inputSchema: {},
        },
        async () => {
          const names = [...categoryNames().values()];
          return textResult(names.length === 0 ? "No hay categorías." : names.map((n) => `- ${n}`).join("\n"));
        },
      );
    },
  },
  {
    type: LEDGER_ACCOUNTANT_CELL,
    factory: (context) => {
      const resource = { key: LEDGER_ACCOUNTANT_CELL, molecule: new ExpenseMolecule(context.tenantDbPath) };
      context.trackResource(resource);
      return [resource];
    },
    registerTools: (server, context) => {
      server.registerTool(
        "list_pending_expenses",
        {
          description: "Lista los gastos pendientes de revisión del cliente seleccionado.",
          inputSchema: {},
        },
        async () => {
          const molecule = moleculeFor(context, LEDGER_ACCOUNTANT_CELL);
          const categoryNames = new Map(molecule.listCategories().map((c) => [c.id, c.nombre]));
          return textResult(
            formatExpenses(molecule.listExpenses("PENDIENTE"), categoryNames, "No hay gastos pendientes."),
          );
        },
      );

      server.registerTool(
        "get_client_statement",
        {
          description: "Estado de cuenta del cliente seleccionado para un periodo, con deducible y sin soporte.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult("Periodo no válido. Usa AAAA-MM o AAAA-Tn.");
          const molecule = moleculeFor(context, LEDGER_ACCOUNTANT_CELL);
          return textResult(formatStatement(buildStatement(period, molecule.listExpenses(), molecule.listCategories()), true));
        },
      );
    },
  },
];
