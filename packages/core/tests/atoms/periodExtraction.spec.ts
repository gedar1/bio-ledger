import { describe, it, expect } from "vitest";
import { extractPeriodo } from "../../src/atoms/periodExtraction.js";
import { EXTRACTORS } from "../../src/atoms/chainSpec.js";
import { ledgerClientProfile } from "../../src/config/ledgerProfiles.js";

const NOW = new Date(2026, 10, 16); // noviembre de 2026

describe("extractPeriodo", () => {
  it("toma el mes en español sin año, con el año actual", () => {
    expect(extractPeriodo("cuánto gasté en marzo", NOW)).toBe("2026-03");
    expect(extractPeriodo("cuanto gaste en septiembre", NOW)).toBe("2026-09");
  });

  it("toma el mes en neerlandés e inglés", () => {
    expect(extractPeriodo("wat heb ik in maart uitgegeven", NOW)).toBe("2026-03");
    expect(extractPeriodo("how much did I spend in march", NOW)).toBe("2026-03");
  });

  it("respeta el año explícito", () => {
    expect(extractPeriodo("estado de cuenta de noviembre 2025", NOW)).toBe("2025-11");
    expect(extractPeriodo("marzo de 2025", NOW)).toBe("2025-03");
  });

  it("acepta formatos numéricos AAAA-MM, MM/AAAA y AAAA-Tn", () => {
    expect(extractPeriodo("2026-03", NOW)).toBe("2026-03");
    expect(extractPeriodo("03/2026", NOW)).toBe("2026-03");
    expect(extractPeriodo("2025-T2", NOW)).toBe("2025-T2");
  });

  it("reconoce trimestres en los tres idiomas y con T1 a T4", () => {
    expect(extractPeriodo("primer trimestre", NOW)).toBe("2026-T1");
    expect(extractPeriodo("tweede kwartaal", NOW)).toBe("2026-T2");
    expect(extractPeriodo("third quarter", NOW)).toBe("2026-T3");
    expect(extractPeriodo("dame el T4 de 2025", NOW)).toBe("2025-T4");
  });

  it("'este mes' da el mes de la fecha actual", () => {
    expect(extractPeriodo("cuánto llevo gastado este mes", NOW)).toBe("2026-11");
    expect(extractPeriodo("wat heb ik deze maand uitgegeven", NOW)).toBe("2026-11");
  });

  it("devuelve null si hay dos periodos distintos o ninguno", () => {
    expect(extractPeriodo("compara marzo y abril", NOW)).toBeNull();
    expect(extractPeriodo("hola, ¿cómo estás?", NOW)).toBeNull();
    expect(extractPeriodo("", NOW)).toBeNull();
  });

  it("no confunde palabras comunes con meses", () => {
    expect(extractPeriodo("you may ask me later", NOW)).toBeNull();
  });
});

describe("integración con el motor", () => {
  it("el extractor de periodo está registrado en el motor", () => {
    expect(EXTRACTORS.periodo("marzo")).not.toBeNull();
  });

  it("el perfil del cliente declara la cadena por periodo con su dato requerido", () => {
    const chain = ledgerClientProfile.chains?.find((c) => c.id === "estado-de-cuenta");
    expect(chain?.requires).toEqual([
      expect.objectContaining({ name: "periodo", extractor: "periodo" }),
    ]);
    expect(chain?.steps[0]).toEqual({
      cell: "ledger_cliente",
      tool: "get_my_statement",
      args: { periodo: "$requires.periodo" },
    });
  });
});
