import { describe, it, expect } from "vitest";
import { monthlyTotals, type StatementExpense } from "../../src/atoms/statement.js";

const expense = (over: Partial<StatementExpense>): StatementExpense =>
  ({
    fecha: "2025-03-10",
    importe_cents: 1000,
    tasa_btw: 0,
    categoria_id: 1,
    estado: "APROBADO",
    ...over,
  }) as StatementExpense;

describe("gasto por mes del año", () => {
  it("devuelve doce meses aunque no haya gastos", () => {
    const series = monthlyTotals(2025, []);
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ label: "2025-01", cents: 0 });
    expect(series[11]).toEqual({ label: "2025-12", cents: 0 });
  });

  it("suma aprobados y pendientes en su mes", () => {
    const series = monthlyTotals(2025, [
      expense({ fecha: "2025-03-01", importe_cents: 1000, estado: "APROBADO" }),
      expense({ fecha: "2025-03-20", importe_cents: 250, estado: "PENDIENTE" }),
      expense({ fecha: "2025-07-05", importe_cents: 400, estado: "APROBADO" }),
    ]);
    expect(series[2].cents).toBe(1250);
    expect(series[6].cents).toBe(400);
  });

  it("deja fuera rechazados y anulados", () => {
    const series = monthlyTotals(2025, [
      expense({ fecha: "2025-05-01", importe_cents: 999, estado: "RECHAZADO" }),
      expense({ fecha: "2025-05-02", importe_cents: 888, estado: "ANULADO" }),
    ]);
    expect(series[4].cents).toBe(0);
  });

  it("ignora gastos de otros años", () => {
    const series = monthlyTotals(2025, [
      expense({ fecha: "2024-03-10", importe_cents: 1000 }),
      expense({ fecha: "2026-03-10", importe_cents: 1000 }),
    ]);
    expect(series.every((s) => s.cents === 0)).toBe(true);
  });
});
