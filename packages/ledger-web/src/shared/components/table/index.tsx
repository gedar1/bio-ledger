import { formatValue } from "@/shared/helpers/helpers";
import { COLUMN_LABEL, ICON_STATE, LOCALE } from "@/shared/utils";
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
      <h3 className="font-serif text-xl">{title}</h3>
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
    </section>
  );
};

export default Table;
