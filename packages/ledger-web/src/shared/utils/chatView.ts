import circleCheckIcon from "@/assets/icons/circle-check.svg";
import circleDashedCheckIcon from "@/assets/icons/circle-dashed-check.svg";
import circleX from "@/assets/icons/circle-x.svg";
import creditCardX from "@/assets/icons/credit-card-x.svg";

/** Claves de columna e ítem que el backend manda, traducidas aquí. */
export const COLUMN_LABEL: Record<string, string> = {
  category: "chat.viewColCategory",
  amount: "chat.viewColAmount",
  count: "chat.viewColCount",
  date: "chat.viewColDate",
  state: "chat.viewColState",
  concept: "chat.viewColConcept",
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
