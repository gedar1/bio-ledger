import React, { useEffect, useRef, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiPost } from "../../api";
import type { ChatMessage, ChatPanelProps, ChatView } from "@/types";

import { BloubAttentif } from "./spinners";

/**
 * Chat del cliente con el asistente del producto. Adaptado de ExecutionChat del dashboard:
 * mismo envío a POST /api/chat, mismo bloqueo mientras responde, reintento tras error,
 * desplazamiento automático y cancelación si la pantalla se desmonta.
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ token, onView }) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Al salir de la pantalla no se aplican respuestas que lleguen después.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Envía el texto al backend y agrega la respuesta real, o marca el mensaje como fallido. */
  async function send(text: string, userMessageId: string) {
    setBusy(true);
    try {
      const data = await apiPost<{ response: string; view?: ChatView | null }>(
        "chat",
        { message: text },
        token,
      );
      if (cancelledRef.current) return;
      if (data.view) onView?.(data.view);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: data.response },
      ]);
    } catch {
      if (cancelledRef.current) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, failed: true } : m)),
      );
    } finally {
      if (!cancelledRef.current) setBusy(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const id = crypto.randomUUID();
    setInput("");
    setMessages((prev) => [...prev, { id, role: "user", text }]);
    void send(text, id);
  }

  function retry(message: ChatMessage) {
    if (busy) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, failed: false } : m)),
    );
    void send(message.text, message.id);
  }

  return (
    <section className="relative flex h-full min-h-0 flex-col gap-6">
      <img
        src={BloubAttentif}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 right-4 h-12 w-12 -scale-x-100"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-hairline-soft p-6">
        {messages.length === 0 && (
          <p className="text-sm text-steel">{t("chat.empty")}</p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
              m.role === "user"
                ? "self-end bg-ink text-white"
                : "self-start border border-beige-deep bg-cream"
            }`}
          >
            <span className="mb-1 block text-xs opacity-70">
              {m.role === "user" ? t("chat.you") : t("chat.assistant")}
            </span>
            <span className="whitespace-pre-wrap">{m.text}</span>
            {m.failed && (
              <button
                type="button"
                onClick={() => retry(m)}
                disabled={busy}
                className="mt-2 block text-xs font-medium text-primary-deep underline disabled:opacity-50"
              >
                {t("chat.retry")}
              </button>
            )}
          </div>
        ))}

        {busy && <p className="text-xs text-steel">{t("chat.thinking")}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <label htmlFor="chat-input" className="sr-only">
          {t("chat.placeholder")}
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          disabled={busy}
          className="h-11 flex-1 rounded-lg border border-hairline-strong px-3 text-sm focus:border-2 focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || input.trim() === ""}
          className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
        >
          {t("chat.send")}
        </button>
      </form>
    </section>
  );
};
