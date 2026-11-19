export interface ChatPanelProps {
  /** Token del cliente; cada mensaje se envía con su Authorization. */
  token: string;
  /** Recibe la vista de datos cuando la respuesta la trae. */
  onView?: (view: ChatView) => void;
}

/** Tabla que el backend envía junto a la respuesta. Los importes llegan ya formateados. */
export type ChatView =
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: string[][];
      total?: string;
    }
  | {
      type: "card";
      title: string;
      items: { label: string; value: string }[];
    };

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Mensaje del usuario que falló; permite reintentarlo. */
  failed?: boolean;
}
