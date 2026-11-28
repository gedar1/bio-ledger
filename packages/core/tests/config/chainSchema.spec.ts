import { describe, it, expect } from "vitest";
import { ChainDefinitionSchema } from "../../src/config/chainSchema.js";
import {
  ledgerAccountantProfile,
  ledgerClientProfile,
} from "../../src/config/ledgerProfiles.js";

const req = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  extractor: "cliente",
  ask: `¿Cuál es ${name}?`,
  ...extra,
});

const chain = (
  requires: unknown[],
  args: Record<string, unknown> = { tenantId: "$requires.cliente" },
) => ({
  id: "consulta-prueba",
  description: "prueba",
  requires,
  steps: [{ cell: "ledger_contador", tool: "list_pending_expenses", args }],
  done: "listo",
});

describe("esquema de cadenas: requires", () => {
  it("admite hasta tres datos", () => {
    const ok = ChainDefinitionSchema.safeParse(
      chain(
        [
          req("cliente"),
          req("periodo", { extractor: "periodo" }),
          req("estado", { extractor: "estado" }),
        ],
        {
          tenantId: "$requires.cliente",
          periodo: "$requires.periodo",
          estado: "$requires.estado",
        },
      ),
    );
    expect(ok.success).toBe(true);
  });

  it("rechaza más de tres datos", () => {
    const four = chain([req("a"), req("b"), req("c"), req("d")], {
      tenantId: "$requires.a",
    });
    expect(ChainDefinitionSchema.safeParse(four).success).toBe(false);
  });

  it("un dato es obligatorio salvo que se marque optional", () => {
    const parsed = ChainDefinitionSchema.parse(chain([req("cliente")]));
    expect(parsed.requires[0].optional).toBeFalsy();
    const optional = ChainDefinitionSchema.parse(
      chain([req("cliente", { optional: true })]),
    );
    expect(optional.requires[0].optional).toBe(true);
  });

  it("rechaza nombres repetidos", () => {
    const dup = chain([req("cliente"), req("cliente")]);
    expect(ChainDefinitionSchema.safeParse(dup).success).toBe(false);
  });

  it("rechaza un $requires que no está declarado", () => {
    const missing = chain([req("cliente")], { tenantId: "$requires.otro" });
    expect(ChainDefinitionSchema.safeParse(missing).success).toBe(false);
  });

  it("las cadenas actuales de los perfiles del cliente y del contador siguen siendo válidas", () => {
    for (const c of [
      ...(ledgerClientProfile.chains ?? []),
      ...(ledgerAccountantProfile.chains ?? []),
    ]) {
      expect(ChainDefinitionSchema.safeParse(c).success, c.id).toBe(true);
    }
  });
});
