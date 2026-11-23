/**
 * Vista de datos para el front: una tabla que la respuesta del chat deja al lado,
 * fuera del texto. Los importes llegan ya formateados desde el código de la herramienta.
 *
 * Funciones puras. Lo usa el orquestador para leer la vista de un resultado de herramienta.
 */
import { z } from "zod";

export const ChatViewSchema = z.object({
  type: z.literal("table"),
  title: z.string().min(1),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  total: z.string().optional(),
});

export type ChatView = z.infer<typeof ChatViewSchema>;

/**
 * Saca la vista de un resultado de herramienta MCP, si lo trae.
 * Devuelve null si no hay vista o si no cumple el esquema.
 */
export function extractChatView(result: unknown): ChatView | null {
  if (typeof result !== "object" || result === null) return null;
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (typeof structured !== "object" || structured === null) return null;
  const parsed = ChatViewSchema.safeParse((structured as { view?: unknown }).view);
  return parsed.success ? parsed.data : null;
}
