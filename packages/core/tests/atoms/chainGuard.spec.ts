import { describe, it, expect } from "vitest";
import { mentionsAny } from "../../src/atoms/chainExtraction.js";
import { ledgerClientProfile } from "../../src/config/ledgerProfiles.js";

const FILTER_TERMS = ["aprobad", "pendient", "rechazad", "anulad", "estado"];

describe("guarda de cadenas con filtro", () => {
  it("detecta un estado en la pregunta, con o sin tilde y en mayúsculas", () => {
    expect(mentionsAny("cuáles son mis gastos aprobados", FILTER_TERMS)).toBe(true);
    expect(mentionsAny("cuales son mis gastos APROBADOS", FILTER_TERMS)).toBe(true);
    expect(mentionsAny("gastos pendientes", FILTER_TERMS)).toBe(true);
  });

  it("no bloquea la lista completa", () => {
    expect(mentionsAny("cuáles son mis gastos", FILTER_TERMS)).toBe(false);
    expect(mentionsAny("muéstrame todos mis gastos", FILTER_TERMS)).toBe(false);
  });

  it("la cadena mis-gastos declara los términos de filtro", () => {
    const chain = ledgerClientProfile.chains?.find((c) => c.id === "mis-gastos");
    expect(chain?.avoidTerms).toContain("aprobad");
    expect(mentionsAny("cuáles son mis gastos aprobados", chain?.avoidTerms ?? [])).toBe(true);
    expect(mentionsAny("cuáles son mis gastos", chain?.avoidTerms ?? [])).toBe(false);
  });
});
