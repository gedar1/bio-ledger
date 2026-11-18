/** Herramienta del motor que muta una célula de un tipo a otro. */
export const MUTATION_TOOL = "stimulate_differentiation";

/**
 * Quita la herramienta de mutación cuando todas las células permitidas ya están mutadas.
 * Sin este filtro, el modelo la llama y el orquestador la bloquea como duplicada.
 * Si alguna célula permitida aún no está mutada, la lista no cambia.
 */
export function filterRedundantMutationTool<T extends { name: string }>(
  tools: readonly T[],
  allowedCells: readonly string[],
  mutatedTypes: ReadonlySet<string>,
): readonly T[] {
  const allMutated =
    allowedCells.length > 0 && allowedCells.every((cell) => mutatedTypes.has(cell));
  if (!allMutated) return tools;
  return tools.filter((tool) => tool.name !== MUTATION_TOOL);
}
