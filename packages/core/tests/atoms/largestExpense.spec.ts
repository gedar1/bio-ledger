import { describe, it, expect } from "vitest";
import { largestExpense, parsePeriod, type LargestCandidate } from "../../src/atoms/statement.js";

const base = { tasa_btw: 21 as const, categoria_id: 1, con_soporte: true };

const gastos: LargestCandidate[] = [
  { ...base, id: 1, fecha: "2025-03-02", importe_cents: 4000, concepto: "Cena", estado: "APROBADO" },
  { ...base, id: 2, fecha: "2025-03-09", importe_cents: 9000, concepto: "Portátil", estado: "PENDIENTE" },
  { ...base, id: 3, fecha: "2025-03-15", importe_cents: 50000, concepto: "Rechazado grande", estado: "RECHAZADO" },
  { ...base, id: 4, fecha: "2025-03-20", importe_cents: 60000, concepto: "Anulado grande", estado: "ANULADO" },
  { ...base, id: 5, fecha: "2025-04-01", importe_cents: 99000, concepto: "Otro mes", estado: "APROBADO" },
];

const marzo = parsePeriod("2025-03")!;

describe("gasto más caro", () => {
  it("devuelve el de mayor importe entre aprobados y pendientes del periodo", () => {
    expect(largestExpense(marzo, gastos)?.id).toBe(2);
  });

  it("ignora rechazados, anulados y gastos de otro periodo aunque sean mayores", () => {
    const result = largestExpense(marzo, gastos);
    expect(result?.concepto).toBe("Portátil");
  });

  it("en empate de importe gana el más antiguo", () => {
    const empate: LargestCandidate[] = [
      { ...base, id: 7, fecha: "2025-03-20", importe_cents: 5000, concepto: "Reciente", estado: "APROBADO" },
      { ...base, id: 8, fecha: "2025-03-05", importe_cents: 5000, concepto: "Antiguo", estado: "PENDIENTE" },
    ];
    expect(largestExpense(marzo, empate)?.concepto).toBe("Antiguo");
  });

  it("sin gastos válidos en el periodo devuelve null", () => {
    expect(largestExpense(parsePeriod("2020-01")!, gastos)).toBeNull();
  });
});
