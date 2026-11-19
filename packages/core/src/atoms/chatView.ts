/**
 * Vista de datos para el front: se muestra junto al chat, fuera del texto de la respuesta.
 * Los importes llegan ya formateados desde el código de la herramienta.
 *
 * Tipos: "table" (filas y columnas) y "card" (pares etiqueta-valor).
 * Funciones puras. Lo usa el orquestador para leer la vista de un resultado de herramienta.
 */
import { z } from "zod";

export const CHAT_VIEW_TYPES = ["table", "card"] as const;
export type ChatViewType = (typeof CHAT_VIEW_TYPES)[number];

const TableViewSchema = z.object({
  type: z.literal("table"),
  title: z.string().min(1),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  total: z.string().optional(),
});

const CardViewSchema = z.object({
  type: z.literal("card"),
  title: z.string().min(1),
  items: z
    .array(z.object({ label: z.string().min(1), value: z.string() }))
    .min(1),
});

export const ChatViewSchema = z.discriminatedUnion("type", [
  TableViewSchema,
  CardViewSchema,
]);

export type ChatView = z.infer<typeof ChatViewSchema>;

/**
 * Saca la vista de un resultado de herramienta MCP, si lo trae.
 * Devuelve null si no hay vista o si no cumple el esquema.
 */
export function extractChatView(result: unknown): ChatView | null {
  if (typeof result !== "object" || result === null) return null;
  const structured = (result as { structuredContent?: unknown })
    .structuredContent;
  if (typeof structured !== "object" || structured === null) return null;
  const parsed = ChatViewSchema.safeParse(
    (structured as { view?: unknown }).view,
  );
  return parsed.success ? parsed.data : null;
}

/**
 * Comprueba que la vista que produjo una herramienta sea del tipo que declara la cadena.
 * Si la cadena no declara tipo, cualquier vista sirve.
 */
export function viewFitsDeclaration(
  view: ChatView,
  declared?: ChatViewType,
): boolean {
  return declared === undefined || view.type === declared;
}
