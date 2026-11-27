import { z } from "zod";
import {
  LEDGER_ACCOUNTANT_CELL,
  LEDGER_CLIENT_CELL,
} from "../config/ledgerCellTypes.js";
import { ToolExecutionError } from "../errors.js";
import { ExpenseMolecule } from "../molecules/ExpenseMolecule.js";
import {
  buildStatement,
  categoryTotals,
  currentMonthCode,
  largestExpense,
  monthlyTotals,
  parsePeriod,
} from "../atoms/statement.js";
import {
  categoryTotalsText,
  expensesListText,
  formatExpenses,
  formatStatement,
  largestExpenseText,
  monthlyTotalsText,
} from "../atoms/ledgerText.js";
import {
  categoryTotalsView,
  expensesListView,
  statementCardView,
  monthlyTableView,
} from "../atoms/ledgerViews.js";
import type { ChatView } from "../atoms/chatView.js";
import type { CellComposition, CellRuntimeContext } from "./CellComposition.js";

type Registration = NonNullable<CellComposition["registrations"]>[number];

const ESTADOS = ["PENDIENTE", "APROBADO", "RECHAZADO", "ANULADO"] as const;

// Sin regex: el proveedor del modelo no admite 'pattern'. Los periodos se validan en el handler.
const PERIODO = z
  .string()
  .describe(
    "Periodo: AAAA-MM para un mes o AAAA-T1 a AAAA-T4 para un trimestre",
  );

const PERIODO_NO_VALIDO = "Periodo no válido. Usa AAAA-MM o AAAA-Tn.";

function moleculeFor(
  context: CellRuntimeContext,
  key: string,
): ExpenseMolecule {
  const molecule = context.getResource<ExpenseMolecule>(key);
  if (!molecule) {
    throw new ToolExecutionError(
      key,
      "La base de gastos no está inicializada.",
    );
  }
  return molecule;
}

function categoryNamesOf(molecule: ExpenseMolecule): Map<number, string> {
  return new Map(
    molecule.listCategories().map((c): [number, string] => [c.id, c.nombre]),
  );
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Respuesta con texto y, si la herramienta la produce, la vista de datos para el panel. */
function toolResult(text: string, view?: ChatView) {
  if (!view) return textResult(text);
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: { view },
  };
}

/** Registro de las células de lectura del producto. Solo leen; nunca escriben. */
export const ledgerRegistrations: Registration[] = [
  {
    type: LEDGER_CLIENT_CELL,
    factory: (context) => {
      const resource = {
        key: LEDGER_CLIENT_CELL,
        molecule: new ExpenseMolecule(context.tenantDbPath),
      };
      context.trackResource(resource);
      return [resource];
    },
    registerTools: (server, context) => {
      server.registerTool(
        "list_my_expenses",
        {
          description:
            "Lista los gastos del cliente. Filtro opcional por estado.",
          inputSchema: {
            estado: z
              .enum(ESTADOS)
              .optional()
              .describe("Solo gastos en este estado. Omitir para todos"),
          },
        },
        async ({ estado }) => {
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const expenses = molecule.listExpenses(estado);
          if (expenses.length === 0) return textResult("No hay gastos.");
          return toolResult(
            expensesListText(expenses, categoryNamesOf(molecule)),
            expensesListView(expenses),
          );
        },
      );

      server.registerTool(
        "get_my_largest_expense",
        {
          description:
            "Gasto de mayor importe del cliente en un mes o trimestre (aprobado y pendiente). Requiere periodo AAAA-MM o AAAA-Tn.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult(PERIODO_NO_VALIDO);
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const expense = largestExpense(period, molecule.listExpenses());
          if (!expense)
            return textResult(`No hay gastos en ${period.periodo}.`);
          const categoryName =
            categoryNamesOf(molecule).get(expense.categoria_id) ??
            "Sin categoría";
          return textResult(largestExpenseText(period, expense, categoryName));
        },
      );

      server.registerTool(
        "get_my_statement",
        {
          description:
            "Estado de cuenta del cliente para un periodo. Sin columna de deducible.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult(PERIODO_NO_VALIDO);
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const statement = buildStatement(
            period,
            molecule.listExpenses(),
            molecule.listCategories(),
          );
          return toolResult(
            formatStatement(statement, false),
            statementCardView(statement, true),
          );
        },
      );

      server.registerTool(
        "get_my_month_statement",
        {
          description:
            "Estado de cuenta del mes actual del cliente, sin periodo. Úsala solo cuando la pregunta sea del mes en curso; si nombra otro mes o trimestre, usa get_my_statement.",
          inputSchema: {},
        },
        async () => {
          const period = parsePeriod(currentMonthCode());
          if (!period)
            return textResult("No se pudo determinar el mes actual.");
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const statement = buildStatement(
            period,
            molecule.listExpenses(),
            molecule.listCategories(),
          );
          return toolResult(
            formatStatement(statement, false),
            statementCardView(statement, false),
          );
        },
      );

      server.registerTool(
        "get_my_monthly_totals",
        {
          description: "Gasto del cliente por mes del año en curso, en tabla (el cliente puede verla como gráfico). Úsala para la evolución mensual del gasto o cuando pida un gráfico.",
          inputSchema: {},
        },
        async () => {
          const year = new Date().getFullYear();
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const series = monthlyTotals(year, molecule.listExpenses());
          return toolResult(
            monthlyTotalsText(year, series),
            monthlyTableView(year, series),
          );
        },
      );

      server.registerTool(
        "list_my_categories",
        {
          description:
            "Lista las categorías de gasto disponibles para el cliente.",
          inputSchema: {},
        },
        async () => {
          const names = [
            ...categoryNamesOf(
              moleculeFor(context, LEDGER_CLIENT_CELL),
            ).values(),
          ];
          return textResult(
            names.length === 0
              ? "No hay categorías."
              : names.map((n) => `- ${n}`).join("\n"),
          );
        },
      );

      server.registerTool(
        "get_my_category_totals",
        {
          description:
            "Cuánto gastó el cliente por categoría en un mes o trimestre indicado (aprobados y pendientes), de mayor a menor. Requiere periodo AAAA-MM o AAAA-Tn.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult(PERIODO_NO_VALIDO);
          const molecule = moleculeFor(context, LEDGER_CLIENT_CELL);
          const totals = categoryTotals(
            period,
            molecule.listExpenses(),
            molecule.listCategories(),
          );
          if (totals.length === 0)
            return textResult(`No hay gastos en ${period.periodo}.`);
          return toolResult(
            categoryTotalsText(period, totals),
            categoryTotalsView(period, totals),
          );
        },
      );
    },
  },
  {
    type: LEDGER_ACCOUNTANT_CELL,
    factory: (context) => {
      const resource = {
        key: LEDGER_ACCOUNTANT_CELL,
        molecule: new ExpenseMolecule(context.tenantDbPath),
      };
      context.trackResource(resource);
      return [resource];
    },
    registerTools: (server, context) => {
      server.registerTool(
        "list_pending_expenses",
        {
          description:
            "Lista los gastos pendientes de revisión del cliente seleccionado.",
          inputSchema: {},
        },
        async () => {
          const molecule = moleculeFor(context, LEDGER_ACCOUNTANT_CELL);
          return textResult(
            formatExpenses(
              molecule.listExpenses("PENDIENTE"),
              categoryNamesOf(molecule),
              "No hay gastos pendientes.",
            ),
          );
        },
      );

      server.registerTool(
        "get_client_statement",
        {
          description:
            "Estado de cuenta del cliente seleccionado para un periodo, con deducible y sin soporte.",
          inputSchema: { periodo: PERIODO },
        },
        async ({ periodo }) => {
          const period = parsePeriod(periodo);
          if (!period) return textResult(PERIODO_NO_VALIDO);
          const molecule = moleculeFor(context, LEDGER_ACCOUNTANT_CELL);
          return textResult(
            formatStatement(
              buildStatement(
                period,
                molecule.listExpenses(),
                molecule.listCategories(),
              ),
              true,
            ),
          );
        },
      );
    },
  },
];
