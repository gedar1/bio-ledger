/**
 * Vistas de datos de las herramientas contables. Mandan claves, formato y valores crudos:
 * las etiquetas y los importes formateados los pone el front.
 *
 * Funciones puras.
 */
import type { ChatView } from "./chatView.js";
import type { ExpenseLine } from "./ledgerText.js";
import type { CategoryTotal, Statement, StatementPeriod } from "./statement.js";

type CardItems = Extract<ChatView, { type: "card" }>["items"];

/** Tabla de lo gastado por categoría, con total en céntimos. */
export function categoryTotalsView(
  period: StatementPeriod,
  totals: readonly CategoryTotal[],
): ChatView {
  return {
    type: "table",
    titleKey: "chat.viewCategoryTitle",
    params: { period: period.periodo },
    columns: [
      { key: "category", format: "text" },
      { key: "amount", format: "cents" },
      { key: "count", format: "count" },
    ],
    rows: totals.map((t) => [t.nombre, t.total_cents, t.cantidad]),
    total: totals.reduce((sum, t) => sum + t.total_cents, 0),
  };
}

/** Tabla de todos los gastos: fecha, estado, concepto e importe en céntimos. */
export function expensesListView(expenses: readonly ExpenseLine[]): ChatView {
  return {
    type: "table",
    titleKey: "chat.viewExpensesTotalTitle",
    params: {},
    columns: [
      { key: "date", format: "text" },
      { key: "state", format: "text" },
      { key: "concept", format: "text" },
      { key: "amount", format: "cents" },
    ],
    rows: expenses.map((e) => [e.fecha, e.estado, e.concepto, e.importe_cents]),
  };
}

/** Card del estado de cuenta. `withTotal` agrega el total de los tres estados. */
export function statementCardView(
  statement: Statement,
  withTotal: boolean,
): ChatView {
  const items: CardItems = [
    { key: "approved", format: "cents", value: statement.aprobados.total_cents },
    { key: "pending", format: "cents", value: statement.pendientes.total_cents },
    { key: "cancelled", format: "cents", value: statement.anulados.total_cents },
  ];
  if (withTotal) {
    items.push({
      key: "total",
      format: "cents",
      value:
        statement.aprobados.total_cents +
        statement.pendientes.total_cents +
        statement.anulados.total_cents,
    });
  }
  return {
    type: "card",
    titleKey: "chat.viewStatementTitle",
    params: { period: statement.periodo },
    items,
  };
}
