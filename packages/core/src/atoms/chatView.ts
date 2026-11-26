/**
 * Vista de datos para el front: se muestra junto al chat, fuera del texto de la respuesta.
 *
 * El backend manda claves, valores crudos y el formato de cada valor. No manda etiquetas ni
 * importes formateados: el front traduce las claves y da formato, según el idioma de la interfaz.
 *
 * Formatos: "text" (texto tal cual), "cents" (importe en céntimos, entero) y "count" (entero).
 * Funciones puras. Lo usa el orquestador para leer la vista de un resultado de herramienta.
 */
import { z } from "zod";

export const CHAT_VIEW_TYPES = ["table", "card", "text", "alert"] as const;
export type ChatViewType = (typeof CHAT_VIEW_TYPES)[number];

export const VALUE_FORMATS = ["text", "cents", "count"] as const;
export type ValueFormat = (typeof VALUE_FORMATS)[number];

const FormatSchema = z.enum(VALUE_FORMATS);
const CellSchema = z.union([z.string(), z.number()]);

const TableViewSchema = z.object({
  type: z.literal("table"),
  /** Clave de traducción del título, por ejemplo "chat.viewCategoryTitle". */
  titleKey: z.string().min(1),
  /** Valores que la clave de título necesita, por ejemplo { period: "2026-11" }. */
  params: z.record(z.string(), CellSchema),
  columns: z
    .array(z.object({ key: z.string().min(1), format: FormatSchema }))
    .min(1),
  rows: z.array(z.array(CellSchema)),
  /** Total en céntimos, si la tabla tiene una columna de importe. */
  total: z.number().int().optional(),
});

const CardViewSchema = z.object({
  type: z.literal("card"),
  titleKey: z.string().min(1),
  params: z.record(z.string(), CellSchema),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        format: FormatSchema,
        value: CellSchema,
      }),
    )
    .min(1),
});

const AlertViewSchema = z.object({
  type: z.literal("alert"),
  titleKey: z.string().min(1),
  description: z.string().min(1),
});

export const ChatViewSchema = z.discriminatedUnion("type", [
  TableViewSchema,
  CardViewSchema,
  AlertViewSchema,
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
