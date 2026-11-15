import { describe, it, expect } from "vitest";
import { buildStatement, parsePeriod, splitBtw, type StatementExpense } from "../../src/atoms/statement.js";

describe("periodos", () => {
  it("un mes va del día 1 al último día", () => {
    expect(parsePeriod("2025-02")).toEqual({ periodo: "2025-02", desde: "2025-02-01", hasta: "2025-02-28" });
    expect(parsePeriod("2024-02")?.hasta).toBe("2024-02-29");
  });

  it("un trimestre cubre tres meses", () => {
    expect(parsePeriod("2025-T1")).toEqual({ periodo: "2025-T1", desde: "2025-01-01", hasta: "2025-03-31" });
    expect(parsePeriod("2025-T4")).toEqual({ periodo: "2025-T4", desde: "2025-10-01", hasta: "2025-12-31" });
  });

  it("rechaza formatos y meses inválidos", () => {
    expect(parsePeriod("2025-13")).toBeNull();
    expect(parsePeriod("2025-T5")).toBeNull();
    expect(parsePeriod("marzo")).toBeNull();
  });
});

describe("BTW", () => {
  it("separa el BTW de un total con IVA incluido", () => {
    expect(splitBtw(12100, 21)).toEqual({ netCents: 10000, btwCents: 2100 });
    expect(splitBtw(1090, 9)).toEqual({ netCents: 1000, btwCents: 90 });
    expect(splitBtw(500, 0)).toEqual({ netCents: 500, btwCents: 0 });
  });
});

describe("buildStatement", () => {
  const period = parsePeriod("2025-03")!;
  const categories = [
    { id: 1, nombre: "Transporte", deducible: true },
    { id: 2, nombre: "Seguros", deducible: null },
  ];
  const e = (over: Partial<StatementExpense>): StatementExpense => ({
    fecha: "2025-03-10",
    importe_cents: 1000,
    tasa_btw: 0,
    categoria_id: 1,
    estado: "APROBADO",
    con_soporte: true,
    ...over,
  });

  it("solo los aprobados forman los totales; los pendientes se cuentan aparte", () => {
    const statement = buildStatement(
      period,
      [e({ importe_cents: 1000 }), e({ importe_cents: 500, estado: "PENDIENTE" }), e({ estado: "RECHAZADO" })],
      categories,
    );

    expect(statement.aprobados.cantidad).toBe(1);
    expect(statement.aprobados.total_cents).toBe(1000);
    expect(statement.pendientes).toEqual({ cantidad: 1, total_cents: 500 });
  });

  it("ignora gastos fuera del periodo", () => {
    const statement = buildStatement(period, [e({ fecha: "2025-02-28" }), e({ fecha: "2025-04-01" })], categories);
    expect(statement.aprobados.cantidad).toBe(0);
  });

  it("cuenta como deducible solo lo aprobado con soporte y de categoría deducible", () => {
    const statement = buildStatement(
      period,
      [
        e({ importe_cents: 1000, categoria_id: 1, con_soporte: true }),
        e({ importe_cents: 700, categoria_id: 1, con_soporte: false }),
        e({ importe_cents: 300, categoria_id: 2, con_soporte: true }),
      ],
      categories,
    );

    expect(statement.aprobados.deducible_cents).toBe(1000);
    expect(statement.aprobados.sin_soporte_cents).toBe(700);
  });

  it("separa base y BTW por tasa", () => {
    const statement = buildStatement(period, [e({ importe_cents: 12100, tasa_btw: 21 })], categories);
    const [tasa] = statement.aprobados.por_tasa_btw;

    expect(tasa).toEqual({ tasa: 21, base_cents: 10000, btw_cents: 2100, total_cents: 12100 });
  });

  it("empieza con saldo inicial 0", () => {
    expect(buildStatement(period, [], categories).saldo_inicial_cents).toBe(0);
  });
});
