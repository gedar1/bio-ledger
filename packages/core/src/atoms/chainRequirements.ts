/**
 * Reúne los datos que pide una cadena, en el orden en que se declaran. Función pura: el
 * extractor llega como parámetro, así que no depende del cortex ni de la cuenta.
 *
 * Reglas:
 *   - Un dato que ya se conoce no se vuelve a extraer.
 *   - Si el extractor lo encuentra en el texto, se guarda.
 *   - Si no lo encuentra y es opcional, se omite sin preguntar.
 *   - Si no lo encuentra y es obligatorio, es el dato que falta: la cadena debe preguntarlo.
 */
import type { ChainRequirement } from "../config/chainSchema.js";

export type CollectResult =
  | {
      readonly status: "complete";
      readonly values: Record<string, string | undefined>;
    }
  | {
      readonly status: "missing";
      readonly requirement: ChainRequirement;
      readonly values: Record<string, string | undefined>;
    };

export function collectRequirements(
  requires: readonly ChainRequirement[],
  known: Readonly<Record<string, string | undefined>>,
  extract: (requirement: ChainRequirement) => string | null,
): CollectResult {
  const values: Record<string, string | undefined> = { ...known };
  for (const requirement of requires) {
    if (requirement.name in values) continue;
    const value = extract(requirement);
    if (value !== null) {
      values[requirement.name] = value;
      continue;
    }
    if (requirement.optional) {
      // Ausente: queda como undefined, así el paso lo omite sin preguntar.
      values[requirement.name] = undefined;
      continue;
    }
    return { status: "missing", requirement, values };
  }
  return { status: "complete", values };
}
