export interface ChatPanelProps {
  /** Token del cliente; cada mensaje se envía con su Authorization. */
  token: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Mensaje del usuario que falló; permite reintentarlo. */
  failed?: boolean;
}
