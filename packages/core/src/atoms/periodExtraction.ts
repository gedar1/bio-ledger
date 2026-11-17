/**
 * Extrae un periodo del mensaje: "AAAA-MM" para un mes o "AAAA-Tn" para un trimestre.
 * Función pura. Reconoce español, neerlandés e inglés.
 *
 * Reglas:
 * - Sin año explícito, usa el año de `now`.
 * - "este mes", "mes actual", "deze maand" y "this month" dan el mes de `now`.
 * - Si el mensaje trae más de un periodo distinto, o ninguno, devuelve null.
 */

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
  juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
  january: 1, february: 2, march: 3, june: 6,
  july: 7, august: 8, october: 10,
};

const ORDINAL_QUARTERS: Record<string, number> = {
  primer: 1, segundo: 2, tercer: 3, cuarto: 4,
  eerste: 1, tweede: 2, derde: 3, vierde: 4,
  first: 1, second: 2, third: 3, fourth: 4,
};

/** Quita tildes y pasa a minúsculas, para comparar sin depender de acentos. */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function monthCode(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function extractPeriodo(text: string, now: Date = new Date()): string | null {
  const t = normalize(text);
  const year = (() => {
    const explicit = /\b(20\d{2})\b/.exec(t);
    return explicit ? Number(explicit[1]) : now.getFullYear();
  })();
  const found = new Set<string>();

  if (/\b(este mes|mes actual|deze maand|this month)\b/.test(t)) {
    found.add(monthCode(now.getFullYear(), now.getMonth() + 1));
  }

  for (const [name, month] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) found.add(monthCode(year, month));
  }

  for (const match of t.matchAll(/\b(20\d{2})-(0[1-9]|1[0-2])\b/g)) {
    found.add(monthCode(Number(match[1]), Number(match[2])));
  }
  for (const match of t.matchAll(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/g)) {
    found.add(monthCode(Number(match[2]), Number(match[1])));
  }
  for (const match of t.matchAll(/\b(20\d{2})-t([1-4])\b/g)) {
    found.add(`${match[1]}-T${match[2]}`);
  }
  for (const match of t.matchAll(/\b(?:t|q)([1-4])\b/g)) {
    found.add(`${year}-T${match[1]}`);
  }
  for (const match of t.matchAll(/\b(primer|segundo|tercer|cuarto|eerste|tweede|derde|vierde|first|second|third|fourth) (?:trimestre|kwartaal|quarter)\b/g)) {
    const quarter = ORDINAL_QUARTERS[match[1]];
    if (quarter) found.add(`${year}-T${quarter}`);
  }

  return found.size === 1 ? [...found][0] : null;
}
