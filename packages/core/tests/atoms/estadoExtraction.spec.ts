import { describe, it, expect } from "vitest";
import { extractEstado } from "../../src/atoms/estadoExtraction.js";

describe("extractor de estado", () => {
  it("reconoce un estado en español, neerlandés e inglés", () => {
    expect(extractEstado("cuáles son mis gastos aprobados")).toBe("APROBADO");
    expect(extractEstado("gastos pendientes")).toBe("PENDIENTE");
    expect(extractEstado("welke uitgaven zijn afgewezen")).toBe("RECHAZADO");
    expect(extractEstado("show my cancelled expenses")).toBe("ANULADO");
    expect(extractEstado("welke zijn goedgekeurd")).toBe("APROBADO");
  });

  it("no distingue mayúsculas ni tildes", () => {
    expect(extractEstado("GASTOS RECHAZADOS")).toBe("RECHAZADO");
    expect(extractEstado("anulados")).toBe("ANULADO");
  });

  it("devuelve null si no hay estado o si hay más de uno", () => {
    expect(extractEstado("muéstrame todos mis gastos")).toBeNull();
    expect(extractEstado("aprobados y pendientes")).toBeNull();
  });
});
