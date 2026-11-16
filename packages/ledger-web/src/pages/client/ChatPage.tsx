import { useTranslation } from "react-i18next";
import { ChatPanel } from "../../components/ChatPanel";

/** Pantalla del chat del cliente. La lógica de conversación vive en ChatPanel. */
export function ChatPage({ token }: { token: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-serif text-3xl">{t("chat.title")}</h2>
      <ChatPanel token={token} />
    </div>
  );
}
