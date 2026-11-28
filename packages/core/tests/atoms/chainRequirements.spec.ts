import { describe, it, expect } from "vitest";
import { collectRequirements } from "../../src/atoms/chainRequirements.js";
import type { ChainRequirement } from "../../src/config/chainSchema.js";

const cliente: ChainRequirement = { name: "cliente", extractor: "cliente", ask: "¿Qué cliente?", optional: false };
const periodo: ChainRequirement = { name: "periodo", extractor: "periodo", ask: "¿Qué periodo?", optional: false };
const estado: ChainRequirement = { name: "estado", extractor: "estado", ask: "¿Qué estado?", optional: true };

/** Extractor de prueba: devuelve un valor fijo por nombre de dato, o null si no está. */
const found = (values: Record<string, string>) => (req: ChainRequirement) => values[req.name] ?? null;

describe("reúne los datos de una cadena", () => {
  it("está completo cuando todos los datos se encuentran", () => {
    const result = collectRequirements([cliente, periodo], {}, found({ cliente: "cliente-vivo", periodo: "2026-03" }));
    expect(result).toEqual({ status: "complete", values: { cliente: "cliente-vivo", periodo: "2026-03" } });
  });

  it("pide el primer dato obligatorio que falta, en orden", () => {
    const result = collectRequirements([cliente, periodo], {}, found({ periodo: "2026-03" }));
    expect(result.status).toBe("missing");
    if (result.status === "missing") {
      expect(result.requirement.name).toBe("cliente");
      expect(result.values).toEqual({});
    }
  });

  it("no vuelve a extraer un dato que ya se conoce", () => {
    const seen: string[] = [];
    const extract = (req: ChainRequirement) => {
      seen.push(req.name);
      return req.name === "periodo" ? "2026-03" : null;
    };
    const result = collectRequirements([cliente, periodo], { cliente: "cliente-vivo" }, extract);
    expect(seen).toEqual(["periodo"]);
    expect(result).toEqual({ status: "complete", values: { cliente: "cliente-vivo", periodo: "2026-03" } });
  });

  it("un dato opcional ausente no se pregunta y queda como undefined", () => {
    const result = collectRequirements([cliente, estado], {}, found({ cliente: "cliente-vivo" }));
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.values.estado).toBeUndefined();
      expect("estado" in result.values).toBe(true);
    }
  });

  it("un dato opcional presente se guarda", () => {
    const result = collectRequirements([cliente, estado], {}, found({ cliente: "cliente-vivo", estado: "APROBADO" }));
    expect(result).toEqual({ status: "complete", values: { cliente: "cliente-vivo", estado: "APROBADO" } });
  });

  it("un obligatorio que falta se pide aunque haya un opcional antes", () => {
    const result = collectRequirements([estado, cliente], {}, found({ estado: "APROBADO" }));
    expect(result.status).toBe("missing");
    if (result.status === "missing") expect(result.requirement.name).toBe("cliente");
  });
});
