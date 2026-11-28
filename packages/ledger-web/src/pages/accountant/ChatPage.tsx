import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatView } from "@/types";
import { ChatPanel, ViewPanel } from "@/components";

/**
 * Asistente del contador. Vive en la sección del contador. Cada pregunta nombra al cliente
 * (nombre completo o ID) y el asistente trae sus datos, igual que en la vista del cliente.
 */
export const AccountantChatPage = ({ token }: Readonly<{ token: string }>) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ChatView | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-3xl">{t("nav.chat")}</h2>
      <div className="grid gap-6 lg:h-[70vh] lg:grid-cols-2">
        <ChatPanel token={token} onView={setView} endpoint="accountant/chat" />
        <ViewPanel view={view} />
      </div>
    </div>
  );
};
