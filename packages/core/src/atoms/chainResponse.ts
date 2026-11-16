/**
 * Texto que responde una cadena con `respond: "tool"`. Acepta el texto directo o el
 * contenido MCP `{ content: [{ type: "text", text }] }`. null si no hay texto.
 */
export function extractToolText(output: unknown): string | null {
  if (typeof output === "string") return output.trim() === "" ? null : output;
  if (typeof output !== "object" || output === null) return null;
  const content = (output as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const texts = content
    .filter((part): part is { type: "text"; text: string } => {
      return (
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      );
    })
    .map((part) => part.text);
  const joined = texts.join("\n").trim();
  return joined === "" ? null : joined;
}
