import { useState } from "react";
import Chart from "@/shared/components/chart";
import { formatValue } from "@/shared/helpers/helpers";
import {
  COLUMN_LABEL,
  ICON_STATE,
  ICON_VIEW,
  LOCALE,
  chartDataOf,
  chartKindsOf,
  type ChartKind,
} from "@/shared/utils";
import type { ChatCell, ValueFormat } from "@/types";
import { useTranslation } from "react-i18next";

interface TableProps {
  type?: "table";
  titleKey: string;
  params: Record<string, ChatCell>;
  columns: { key: string; format: ValueFormat }[];
  rows: ChatCell[][];
  /** Total en céntimos, si la tabla tiene columna de importe. */
  total?: number;
  totalIndex: number;
}

/**
 * Tabla de datos. Si sus datos admiten gráfico, ofrece un selector para verlos como
 * barras, línea o circular. El gráfico se dibuja en el front con los mismos datos.
 */
const Table = ({
  titleKey,
  params,
  columns,
  rows,
  total,
  totalIndex,
}: Readonly<TableProps>) => {
  const { t, i18n } = useTranslation();
  const locale = LOCALE[i18n.language] ?? "nl-NL";
  const title = t(titleKey, params);
  const chartData = chartDataOf(columns, rows);
  const kinds = chartKindsOf(chartData);
  // "table" es la vista por defecto. Si el tipo elegido ya no aplica a estos datos, vuelve a la tabla.
  const [choice, setChoice] = useState<ChartKind | "table">("table");
  const active =
    choice !== "table" && kinds.includes(choice) ? choice : "table";

  const formatTotal = (index: number) => {
    return index === totalIndex
      ? formatValue(total as number, "cents", locale)
      : "";
  };

  return (
    <section
      id={`table-${titleKey}`}
      className="flex flex-col h-fit gap-3 rounded-lg border border-hairline-soft p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-serif text-xl">{title}</h3>
        {kinds.length > 0 && (
          <div role="group" aria-label={title} className="flex gap-1 text-xs">
            {["table" as const, ...kinds].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={active === option}
                onClick={() => setChoice(option)}
                className={`rounded-md border px-2 py-1 ${
                  active === option
                    ? "border-primary"
                    : "border-hairline-strong"
                }`}
              >
                <img
                  alt={option}
                  src={
                    active === option
                      ? ICON_VIEW[`${option}Icon`]
                      : ICON_VIEW[`${option}IconDisabled`]
                  }
                ></img>
              </button>
            ))}
          </div>
        )}
      </div>
      {active !== "table" && chartData ? (
        <Chart kind={active} data={chartData} title={title} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline-strong">
                {columns.map((column) => (
                  <th key={column.key} className="py-2 pr-4 font-medium">
                    {t(COLUMN_LABEL[column.key] ?? column.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-hairline-soft">
                  {row.map((cell, cellIndex) => {
                    const column = columns[cellIndex];
                    // Columna de estado: el icono reemplaza al texto cuando el valor es un estado conocido.
                    const icon =
                      column.key === "state"
                        ? ICON_STATE[String(cell)]
                        : undefined;
                    return (
                      <td key={cellIndex} className="py-2 pr-4">
                        {icon ? (
                          <img
                            src={icon}
                            alt={String(cell)}
                            title={String(cell)}
                            className="h-5 w-5"
                          />
                        ) : (
                          formatValue(cell, column.format, locale)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {total !== undefined && totalIndex >= 0 && (
              <tfoot>
                <tr className="font-medium">
                  {columns.map((column, index) => (
                    <td key={column.key} className="py-2 pr-4">
                      {index === 0 ? t("chat.viewTotal") : formatTotal(index)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
};

export default Table;
