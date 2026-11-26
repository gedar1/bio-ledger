import checkIcon from "@/assets/icons/check_check.svg";
import scanIcon from "@/assets/icons/scan-search.svg";
import trashIcon from "@/assets/icons/trash-2.svg";
import bellIcon from "@/assets/icons/bell.svg";

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
  PENDIENTE: scanIcon,
  APROBADO: checkIcon,
  RECHAZADO: trashIcon,
  ANULADO: bellIcon,
};
