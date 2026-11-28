/**
 * Extrae el estado de gasto de un mensaje: aprobado, pendiente, rechazado o anulado.
 * Funciones puras. Lo usa el extractor `estado` de las cadenas.
 *
 * Si el mensaje no menciona ningún estado, o menciona más de uno, devuelve null.
 * En ese caso la cadena pide el estado en vez de adivinarlo.
 */
import type { ExpenseState } from "./expenseRules.js";

/** Términos por estado, sin tildes y en minúsculas, en español, neerlandés e inglés. */
const TERMS: Record<ExpenseState, readonly string[]> = {
  APROBADO: ["aprobad", "goedgekeurd", "approved"],
  PENDIENTE: [
    "pendient",
    "in behandeling",
    "in afwachting",
    "te beoordelen",
    "pending",
  ],
  RECHAZADO: ["rechazad", "afgewezen", "rejected"],
  ANULADO: ["anulad", "geannuleerd", "cancelled", "canceled"],
};

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Devuelve el único estado que menciona el texto, o null si ninguno o varios.
 *
 * @example extractEstado("cuáles son mis gastos aprobados") // → "APROBADO"
 * @example extractEstado("aprobados y pendientes") // → null
 */
export function extractEstado(text: string): ExpenseState | null {
  const normalized = normalize(text);
  const found = (Object.keys(TERMS) as ExpenseState[]).filter((estado) =>
    TERMS[estado].some((term) => normalized.includes(term)),
  );
  return found.length === 1 ? found[0] : null;
}
