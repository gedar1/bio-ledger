/**
 * Reglas puras de los gastos. Sin efectos ni acceso a base de datos.
 *
 * Estados: PENDIENTE → APROBADO | RECHAZADO. Una decisión es final.
 */

export const EXPENSE_STATES = ["PENDIENTE", "APROBADO", "RECHAZADO"] as const;
export type ExpenseState = (typeof EXPENSE_STATES)[number];

export const EXPENSE_CREATORS = ["ACCOUNTANT", "CLIENT"] as const;
export type ExpenseCreator = (typeof EXPENSE_CREATORS)[number];

/** Tasas de BTW de los Países Bajos, en porcentaje. */
export const BTW_RATES = [0, 9, 21] as const;
export type BtwRate = (typeof BTW_RATES)[number];

/** Nota mínima para rechazar un gasto. */
export const MIN_REJECTION_NOTE_LENGTH = 3;

/** El cliente solo edita sus propios gastos mientras siguen pendientes. */
export function canClientModify(state: ExpenseState, creator: ExpenseCreator): boolean {
  return state === "PENDIENTE" && creator === "CLIENT";
}

/** Solo un gasto pendiente puede aprobarse o rechazarse. */
export function canDecide(state: ExpenseState): boolean {
  return state === "PENDIENTE";
}

/** Devuelve un mensaje de error si la nota no basta para rechazar, o null si basta. */
export function validateRejectionNote(note: string | undefined): string | null {
  const trimmed = (note ?? "").trim();
  if (trimmed.length < MIN_REJECTION_NOTE_LENGTH) {
    return `La nota de rechazo debe tener al menos ${MIN_REJECTION_NOTE_LENGTH} caracteres`;
  }
  return null;
}
