export interface ChatPanelProps {
  /** Token del cliente; cada mensaje se envía con su Authorization. */
  token: string;
  /** Recibe la vista de datos cuando la respuesta la trae. */
  onView?: (view: ChatView) => void;
}

/** Tabla que el backend envía junto a la respuesta. Los importes llegan ya formateados. */
/** Valor crudo que manda el backend: texto o número. */
export type ChatCell = string | number;
/** Cómo se muestra un valor. Los importes llegan en céntimos. */
export type ValueFormat = "text" | "cents" | "count" | "month";

/** Vista de datos del backend. Trae claves y valores crudos; el front traduce y da formato. */
export type ChatView =
  | {
      type: "table";
      titleKey: string;
      params: Record<string, ChatCell>;
      columns: { key: string; format: ValueFormat }[];
      rows: ChatCell[][];
      /** Total en céntimos, si la tabla tiene columna de importe. */
      total?: number;
    }
  | {
      type: "card";
      titleKey: string;
      params: Record<string, ChatCell>;
      items: { key: string; format: ValueFormat; value: ChatCell }[];
    };

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Mensaje del usuario que falló; permite reintentarlo. */
  failed?: boolean;
}
