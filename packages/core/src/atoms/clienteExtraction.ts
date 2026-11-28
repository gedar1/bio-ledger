/**
 * Extrae el cliente de un mensaje del contador: por ID completo, por nombre completo o por
 * nombre parcial. Funciones puras. Lo usa el extractor `cliente` de las cadenas.
 *
 * Orden de búsqueda. Si un paso encuentra más de un cliente, se detiene y devuelve null, para
 * que la cadena pida aclaración en vez de elegir:
 *   1. ID completo (`cliente-235`). Un ID que es prefijo de otro no cuenta.
 *   2. Nombre completo visible (`Juan Pérez`), sin tildes ni mayúsculas.
 *   3. Palabra del nombre (`Juan`), solo si identifica un único cliente.
 */

/** Lo que el extractor necesita de cada cliente de la cuenta. */
export interface ClienteRef {
  tenant_id: string;
  display_name: string;
}

/** Palabras de un nombre demasiado cortas para usarlas solas (evita "de", "la"…). */
const MIN_PARTIAL_LENGTH = 3;

const normalize = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** true si `term` aparece en `text` como palabra completa, no dentro de otra palabra o ID. */
function containsWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`(^|[^a-z0-9-])${escaped}(?![a-z0-9-])`).test(text);
}

/**
 * Devuelve el `tenant_id` del único cliente que el mensaje identifica, o null si ninguno o
 * varios coinciden.
 *
 * @example extractCliente("gastos de cliente-235", [juan]) // → "cliente-235"
 * @example extractCliente("gastos de Juan", [juan, juanGarcia]) // → null
 */
export function extractCliente(
  text: string,
  clientes: readonly ClienteRef[],
): string | null {
  const t = normalize(text);

  const porId = clientes.filter((c) => containsWord(t, normalize(c.tenant_id)));
  if (porId.length > 0) return porId.length === 1 ? porId[0].tenant_id : null;

  const porNombre = clientes.filter((c) =>
    containsWord(t, normalize(c.display_name)),
  );
  if (porNombre.length > 0)
    return porNombre.length === 1 ? porNombre[0].tenant_id : null;

  const porPalabra = clientes.filter((c) =>
    normalize(c.display_name)
      .split(" ")
      .some(
        (palabra) =>
          palabra.length >= MIN_PARTIAL_LENGTH && containsWord(t, palabra),
      ),
  );
  return porPalabra.length === 1 ? porPalabra[0].tenant_id : null;
}
