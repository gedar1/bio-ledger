/**
 * Estado de cuenta: cálculo puro a partir de gastos y categorías. Sin base de datos.
 *
 * Los importes de los gastos incluyen el BTW (así aparecen en el recibo). El BTW se
 * separa con la fórmula: BTW = total × tasa / (100 + tasa).
 */

import type { BtwRate, ExpenseState } from "./expenseRules.js";

export interface StatementPeriod {
  periodo: string;
  desde: string;
  hasta: string;
}

/** Periodo mensual `AAAA-MM` o trimestral `AAAA-Tn` (n = 1 a 4). null si no es válido. */
export function parsePeriod(periodo: string): StatementPeriod | null {
  const monthly = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (monthly) {
    const year = Number(monthly[1]);
    const month = Number(monthly[2]);
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      periodo,
      desde: `${monthly[1]}-${monthly[2]}-01`,
      hasta: `${monthly[1]}-${monthly[2]}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  const quarterly = /^(\d{4})-T([1-4])$/.exec(periodo);
  if (quarterly) {
    const year = Number(quarterly[1]);
    const firstMonth = (Number(quarterly[2]) - 1) * 3 + 1;
    const lastMonth = firstMonth + 2;
    const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
    const mm = (m: number) => String(m).padStart(2, "0");
    return {
      periodo,
      desde: `${quarterly[1]}-${mm(firstMonth)}-01`,
      hasta: `${quarterly[1]}-${mm(lastMonth)}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  return null;
}

/** Separa el BTW de un total con IVA incluido. */
export function splitBtw(
  grossCents: number,
  rate: BtwRate,
): { netCents: number; btwCents: number } {
  const btwCents = Math.round((grossCents * rate) / (100 + rate));
  return { netCents: grossCents - btwCents, btwCents };
}

export interface StatementExpense {
  fecha: string;
  importe_cents: number;
  tasa_btw: BtwRate;
  categoria_id: number;
  estado: ExpenseState;
  con_soporte: boolean;
}

export interface StatementCategory {
  id: number;
  nombre: string;
  deducible: boolean | null;
}

export interface Statement {
  periodo: string;
  desde: string;
  hasta: string;
  moneda: "EUR";
  /** Saldo inicial del periodo. Por ahora siempre 0; el contador lo confirmará. */
  saldo_inicial_cents: number;
  aprobados: {
    cantidad: number;
    total_cents: number;
    por_categoria: Array<{
      categoria_id: number;
      nombre: string;
      total_cents: number;
    }>;
    por_tasa_btw: Array<{
      tasa: BtwRate;
      base_cents: number;
      btw_cents: number;
      total_cents: number;
    }>;
    /** Gastos aprobados, con soporte y de categoría deducible. */
    deducible_cents: number;
    /** Gastos aprobados sin soporte. No cuentan como deducibles. */
    sin_soporte_cents: number;
  };
  pendientes: { cantidad: number; total_cents: number };
  /** Gastos anulados del periodo. No suman en los totales; se muestran para transparencia. */
  anulados: { cantidad: number; total_cents: number };
}

/**
 * Arma el estado de cuenta de un periodo. Solo los gastos aprobados forman los totales;
 * los pendientes se cuentan aparte para que el cliente vea lo que falta revisar.
 */
export function buildStatement(
  period: StatementPeriod,
  expenses: StatementExpense[],
  categories: StatementCategory[],
): Statement {
  const inPeriod = expenses.filter(
    (e) => e.fecha >= period.desde && e.fecha <= period.hasta,
  );
  const approved = inPeriod.filter((e) => e.estado === "APROBADO");
  const pending = inPeriod.filter((e) => e.estado === "PENDIENTE");
  const annulled = inPeriod.filter((e) => e.estado === "ANULADO");
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const porCategoria = new Map<number, number>();
  const porTasa = new Map<
    BtwRate,
    { base: number; btw: number; total: number }
  >();
  let total = 0;
  let deducible = 0;
  let sinSoporte = 0;

  for (const e of approved) {
    total += e.importe_cents;
    porCategoria.set(
      e.categoria_id,
      (porCategoria.get(e.categoria_id) ?? 0) + e.importe_cents,
    );

    const { netCents, btwCents } = splitBtw(e.importe_cents, e.tasa_btw);
    const tasa = porTasa.get(e.tasa_btw) ?? { base: 0, btw: 0, total: 0 };
    tasa.base += netCents;
    tasa.btw += btwCents;
    tasa.total += e.importe_cents;
    porTasa.set(e.tasa_btw, tasa);

    if (!e.con_soporte) {
      sinSoporte += e.importe_cents;
    } else if (categoryById.get(e.categoria_id)?.deducible === true) {
      deducible += e.importe_cents;
    }
  }

  return {
    periodo: period.periodo,
    desde: period.desde,
    hasta: period.hasta,
    moneda: "EUR",
    saldo_inicial_cents: 0,
    aprobados: {
      cantidad: approved.length,
      total_cents: total,
      por_categoria: [...porCategoria.entries()]
        .map(([id, totalCents]) => ({
          categoria_id: id,
          nombre: categoryById.get(id)?.nombre ?? "Sin categoría",
          total_cents: totalCents,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
      por_tasa_btw: [...porTasa.entries()]
        .map(([tasa, v]) => ({
          tasa,
          base_cents: v.base,
          btw_cents: v.btw,
          total_cents: v.total,
        }))
        .sort((a, b) => a.tasa - b.tasa),
      deducible_cents: deducible,
      sin_soporte_cents: sinSoporte,
    },
    anulados: {
      cantidad: annulled.length,
      total_cents: annulled.reduce((sum, e) => sum + e.importe_cents, 0),
    },
    pendientes: {
      cantidad: pending.length,
      total_cents: pending.reduce((sum, e) => sum + e.importe_cents, 0),
    },
  };
}

export interface CategoryTotal {
  categoria_id: number;
  nombre: string;
  cantidad: number;
  total_cents: number;
}

/**
 * Cuánto se gastó por categoría en un periodo: aprobados y pendientes de aprobación.
 * Rechazados y anulados no cuentan. Va de mayor a menor importe.
 */
export function categoryTotals(
  period: StatementPeriod,
  expenses: StatementExpense[],
  categories: StatementCategory[],
): CategoryTotal[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const porCategoria = new Map<
    number,
    { cantidad: number; total_cents: number }
  >();

  for (const e of expenses) {
    if (e.fecha < period.desde || e.fecha > period.hasta) continue;
    if (e.estado !== "APROBADO" && e.estado !== "PENDIENTE") continue;
    const acumulado = porCategoria.get(e.categoria_id) ?? {
      cantidad: 0,
      total_cents: 0,
    };
    acumulado.cantidad += 1;
    acumulado.total_cents += e.importe_cents;
    porCategoria.set(e.categoria_id, acumulado);
  }

  return [...porCategoria.entries()]
    .map(([id, v]) => ({
      categoria_id: id,
      nombre: categoryById.get(id)?.nombre ?? "Sin categoría",
      cantidad: v.cantidad,
      total_cents: v.total_cents,
    }))
    .sort(
      (a, b) =>
        b.total_cents - a.total_cents || a.nombre.localeCompare(b.nombre),
    );
}

/** Gasto con los campos que necesita el cálculo del más caro. */
export type LargestCandidate = StatementExpense & {
  id: number;
  concepto: string;
};

/**
 * Gasto de mayor importe del periodo, entre aprobados y pendientes. Rechazados y anulados
 * no cuentan. En empate gana el más antiguo. Devuelve null si no hay ninguno.
 */
export function largestExpense<T extends LargestCandidate>(
  period: StatementPeriod,
  expenses: readonly T[],
): T | null {
  let best: T | null = null;
  for (const e of expenses) {
    if (e.fecha < period.desde || e.fecha > period.hasta) continue;
    if (e.estado !== "APROBADO" && e.estado !== "PENDIENTE") continue;
    if (
      best === null ||
      e.importe_cents > best.importe_cents ||
      (e.importe_cents === best.importe_cents && e.fecha < best.fecha)
    ) {
      best = e;
    }
  }
  return best;
}
