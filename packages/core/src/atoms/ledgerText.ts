/**
 * Texto de las respuestas de las herramientas contables. Formato fijo por código: el modelo
 * solo presenta estas líneas y no calcula importes.
 *
 * Funciones puras. Los importes llegan en céntimos y se formatean aquí, en EUR.
 */
import type { ExpenseState } from "./expenseRules.js";
import type {
  CategoryTotal,
  MonthlyTotal,
  Statement,
  StatementPeriod,
} from "./statement.js";

/** Lo que el texto de un gasto necesita. Los campos de nota son opcionales. */
export interface ExpenseLine {
  fecha: string;
  concepto: string;
  categoria_id: number;
  importe_cents: number;
  estado: ExpenseState;
  nota_rechazo?: string | null;
  nota_anulacion?: string | null;
}

const ESTADO_TEXTO: Record<ExpenseState, string> = {
  PENDIENTE: "pendiente",
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  ANULADO: "anulado",
};

const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatCents(cents: number): string {
  return eur.format(cents / 100);
}

/** Una línea por gasto: fecha, concepto, categoría, importe, estado y nota si hay. */
export function formatExpenseLine(e: ExpenseLine, categoryName: string): string {
  const detalle = e.nota_rechazo ?? e.nota_anulacion;
  const sufijo = detalle ? ` (${detalle})` : "";
  return `${e.fecha} · ${e.concepto} · ${categoryName} · ${formatCents(e.importe_cents)} · ${ESTADO_TEXTO[e.estado]}${sufijo}`;
}

/** Lista de gastos con su cantidad, o el texto `empty` si no hay ninguno. */
export function formatExpenses(
  expenses: readonly ExpenseLine[],
  categoryNames: ReadonlyMap<number, string>,
  empty: string,
): string {
  if (expenses.length === 0) return empty;
  const lines = expenses.map((e) =>
    formatExpenseLine(e, categoryNames.get(e.categoria_id) ?? "Sin categoría"),
  );
  return `${expenses.length} gasto(s):\n${lines.join("\n")}`;
}

/** Lista de todos los gastos con su total en EUR. */
export function expensesListText(
  expenses: readonly ExpenseLine[],
  categoryNames: ReadonlyMap<number, string>,
): string {
  const total = expenses.reduce((sum, e) => sum + e.importe_cents, 0);
  const lineas = expenses.map((e) =>
    formatExpenseLine(e, categoryNames.get(e.categoria_id) ?? "Sin categoría"),
  );
  return [
    "Gastos  (aprobados y pendientes), en EUR:",
    ...lineas,
    `Total: ${formatCents(total)}`,
  ].join("\n");
}

/** Gasto de mayor importe del periodo. */
export function largestExpenseText(
  period: StatementPeriod,
  expense: ExpenseLine,
  categoryName: string,
): string {
  return `Gasto más caro de ${period.periodo}:\n${formatExpenseLine(expense, categoryName)}`;
}

/** Desglose por categoría con su total. La lista debe tener al menos una categoría. */
export function categoryTotalsText(
  period: StatementPeriod,
  totals: readonly CategoryTotal[],
): string {
  const total = totals.reduce((sum, t) => sum + t.total_cents, 0);
  const lineas = totals.map(
    (t) =>
      `- ${t.nombre}: ${formatCents(t.total_cents)} (${t.cantidad} gasto(s))`,
  );
  return [
    `Gastos de ${period.periodo} por categoría (aprobados y pendientes), en EUR:`,
    ...lineas,
    `Total: ${formatCents(total)}`,
  ].join("\n");
}

/** Resumen del estado de cuenta. El deducible solo se muestra al contador. */
export function formatStatement(
  statement: Statement,
  verRevision: boolean,
): string {
  const a = statement.aprobados;
  const lineas = [
    `Estado de cuenta ${statement.periodo} (${statement.desde} a ${statement.hasta}), en EUR.`,
    `Aprobados: ${formatCents(a.total_cents)} en ${a.cantidad} gasto(s).`,
    `Pendientes: ${formatCents(statement.pendientes.total_cents)} en ${statement.pendientes.cantidad} gasto(s).`,
    `Anulados: ${formatCents(statement.anulados.total_cents)} en ${statement.anulados.cantidad} gasto(s), no suman.`,
  ];
  if (a.por_categoria.length > 0) {
    lineas.push("Por categoría:");
    for (const c of a.por_categoria) {
      lineas.push(`- ${c.nombre}: ${formatCents(c.total_cents)}`);
    }
  }
  if (a.por_tasa_btw.length > 0) {
    lineas.push("Por tasa de BTW (base, BTW, total):");
    for (const r of a.por_tasa_btw) {
      lineas.push(
        `- ${r.tasa}%: ${formatCents(r.base_cents)}, ${formatCents(r.btw_cents)}, ${formatCents(r.total_cents)}`,
      );
    }
  }
  if (verRevision) {
    lineas.push(`Deducible: ${formatCents(a.deducible_cents)}.`);
    lineas.push(`Sin soporte: ${formatCents(a.sin_soporte_cents)}.`);
  }
  return lineas.join("\n");
}

/** Texto del gastado por mes del año: respaldo del gráfico y lo que lee el modelo. */
export function monthlyTotalsText(year: number, series: readonly MonthlyTotal[]): string {
  const total = series.reduce((sum, s) => sum + s.cents, 0);
  const lineas = series.map((s) => `- ${s.label}: ${formatCents(s.cents)}`);
  return [`Gasto por mes de ${year}, en EUR:`, ...lineas, `Total: ${formatCents(total)}`].join("\n");
}
