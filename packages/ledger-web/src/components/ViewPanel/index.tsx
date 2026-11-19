import React from "react";
import { useTranslation } from "react-i18next";
import type { ChatView } from "../ChatPanel/ChatPanel.types";

/**
 * Tabla de datos que acompaña al chat. Muestra la última vista que devolvió el asistente:
 * el texto de la respuesta va en el chat, y los datos aquí, al lado.
 */
export const ViewPanel: React.FC<{ view: ChatView | null }> = ({ view }) => {
  const { t } = useTranslation();
  if (!view) return null;

  if (view.type === "card") {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-hairline-soft p-6">
        <h3 className="font-serif text-xl">{view.title}</h3>
        <dl className="grid grid-cols-2 gap-4">
          {view.items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dt className="text-xs text-steel">{item.label}</dt>
              <dd className="text-lg font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-hairline-soft p-6">
      <h3 className="font-serif text-xl">{view.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline-strong">
              {view.columns.map((column) => (
                <th key={column} className="py-2 pr-4 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-hairline-soft">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="py-2 pr-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {view.total && (
            <tfoot>
              <tr className="font-medium">
                <td className="py-2 pr-4">{t("chat.viewTotal")}</td>
                <td className="py-2 pr-4">{view.total}</td>
                {view.columns.slice(2).map((column) => (
                  <td key={column} className="py-2 pr-4" />
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
};
