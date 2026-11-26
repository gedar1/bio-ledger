import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatView } from "@/types";
import { ChatPanel, ViewPanel } from "@/components";

/**
 * Pantalla del chat del cliente. El chat responde en texto; cuando hay datos,
 * la tabla aparece al lado. La lógica de conversación vive en ChatPanel.
 */
export const ChatPage = ({ token }: Readonly<{ token: string }>) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ChatView | null>(null);

  console.log(view);
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-3xl">{t("chat.title")}</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChatPanel token={token} onView={setView} />
        <ViewPanel view={view} />
      </div>
    </div>
  );
};
