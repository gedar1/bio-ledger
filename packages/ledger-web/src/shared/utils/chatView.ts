import circleCheckIcon from "@/assets/icons/circle-check.svg";
import circleDashedCheckIcon from "@/assets/icons/circle-dashed-check.svg";
import circleX from "@/assets/icons/circle-x.svg";
import creditCardX from "@/assets/icons/credit-card-x.svg";
import chartPie from "@/assets/icons/chart-pie.svg";
import chartPieDisabled from "@/assets/icons/chart-pie-gray.svg";
import chartColumnDisabled from "@/assets/icons/chart-column-gray.svg";
import chartColumn from "@/assets/icons/chart-column.svg";
import chartLine from "@/assets/icons/chart-line.svg";
import chartLineDisabled from "@/assets/icons/chart-line-gray.svg";
import tableDisabled from "@/assets/icons/table_gray.svg";
import table from "@/assets/icons/table.svg";

/** Claves de columna e ítem que el backend manda, traducidas aquí. */
export const COLUMN_LABEL: Record<string, string> = {
  category: "chat.viewColCategory",
  amount: "chat.viewColAmount",
  count: "chat.viewColCount",
  date: "chat.viewColDate",
  state: "chat.viewColState",
  concept: "chat.viewColConcept",
  month: "chat.viewColMonth",
};
export const ITEM_LABEL: Record<string, string> = {
  approved: "chat.viewItemApproved",
  pending: "chat.viewItemPending",
  cancelled: "chat.viewItemCancelled",
};

/** Icono por estado de gasto. Se importan como módulo para que Vite los incluya en el build. */
export const ICON_STATE: Record<string, string> = {
  PENDIENTE: circleDashedCheckIcon,
  APROBADO: circleCheckIcon,
  RECHAZADO: circleX,
  ANULADO: creditCardX,
};

export const ICON_VIEW: Record<string, string> = {
  pieIcon: chartPie,
  pieIconDisabled: chartPieDisabled,
  barIcon: chartColumn,
  barIconDisabled: chartColumnDisabled,
  lineIcon: chartLine,
  lineIconDisabled: chartLineDisabled,
  tableIcon: table,
  tableIconDisabled: tableDisabled,
};
