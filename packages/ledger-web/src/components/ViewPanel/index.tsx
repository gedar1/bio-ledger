import React from "react";
import type { ChatView } from "@/types";
import Card from "@/shared/components/card";
import Table from "@/shared/components/table";

/**
 * Tabla o card de datos que acompaña al chat. Muestra la última vista que devolvió el asistente.
 * El backend manda claves y valores crudos; aquí se traducen y se formatean.
 */
export const ViewPanel: React.FC<{ view: ChatView | null }> = ({ view }) => {
  if (!view) return null;

  if (view?.type === "card")
    return (
      <Card
        titleKey={`${view.titleKey}`}
        params={view.params}
        items={view.items}
      />
    );

  if (view?.type === "table") {
    const totalIndex = view.columns.findIndex((c) => c.format === "cents");
    return (
      <Table
        rows={view.rows}
        columns={view.columns}
        params={view.params}
        titleKey={view.titleKey}
        totalIndex={totalIndex}
        total={view.total}
      />
    );
  }
};
