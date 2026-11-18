import { describe, it, expect } from "vitest";
import { categoryTotals, parsePeriod, type StatementCategory, type StatementExpense } from "../../src/atoms/statement.js";

const categorias: StatementCategory[] = [
  { id: 1, nombre: "Transporte", deducible: true },
  { id: 2, nombre: "Material de oficina", deducible: false },
];

const gastos: StatementExpense[] = [
  { fecha: "2025-03-02", importe_cents: 1000, tasa_btw: 21, categoria_id: 1, estado: "APROBADO", con_soporte: true },
  { fecha: "2025-03-09", importe_cents: 2500, tasa_btw: 9, categoria_id: 2, estado: "PENDIENTE", con_soporte: true },
  { fecha: "2025-03-15", importe_cents: 700, tasa_btw: 0, categoria_id: 1, estado: "PENDIENTE", con_soporte: false },
  { fecha: "2025-03-20", importe_cents: 9999, tasa_btw: 21, categoria_id: 2, estado: "RECHAZADO", con_soporte: true },
  { fecha: "2025-03-21", importe_cents: 8888, tasa_btw: 21, categoria_id: 1, estado: "ANULADO", con_soporte: true },
  { fecha: "2025-04-01", importe_cents: 5000, tasa_btw: 21, categoria_id: 2, estado: "APROBADO", con_soporte: true },
];

const marzo = parsePeriod("2025-03");

describe("gasto por categoría", () => {
  it("suma aprobados y pendientes del periodo por categoría", () => {
    const totals = categoryTotals(marzo!, gastos, categorias);
    expect(totals).toEqual([
      { categoria_id: 2, nombre: "Material de oficina", cantidad: 1, total_cents: 2500 },
      { categoria_id: 1, nombre: "Transporte", cantidad: 2, total_cents: 1700 },
    ]);
  });

  it("no cuenta rechazados, anulados ni gastos de otro periodo", () => {
    const totals = categoryTotals(marzo!, gastos, categorias);
    const total = totals.reduce((sum, t) => sum + t.total_cents, 0);
    expect(total).toBe(4200);
  });

  it("ordena de mayor a menor importe, no por nombre", () => {
    const totals = categoryTotals(marzo!, gastos, categorias);
    expect(totals.map((t) => t.nombre)).toEqual(["Material de oficina", "Transporte"]);
  });

  it("sin gastos en el periodo devuelve una lista vacía", () => {
    expect(categoryTotals(parsePeriod("2020-01")!, gastos, categorias)).toEqual([]);
  });
});
