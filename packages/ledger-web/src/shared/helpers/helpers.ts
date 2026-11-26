import type { ExpenseForm, PeriodKind, ChatCell, ValueFormat } from "@/types";
import { KEY, LANGUAGES } from "../utils";
import i18n from "@/i18n";

/** Convierte "24,50" o "24.50" a céntimos enteros. null si no es un importe positivo. */
export function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return cents > 0 ? cents : null;
}

export const emptyForm = (): ExpenseForm => ({
  fecha: new Date().toISOString().slice(0, 10),
  amount: "",
  tasa_btw: 21,
  concepto: "",
  categoria_id: "",
  con_soporte: false,
});

export const periodFrom = (
  kind: PeriodKind,
  value: string,
  quarter: number,
  year: number,
): string => {
  return kind === "month" ? value : `${year}-T${quarter}`;
};

/** Da formato a un valor crudo que llega del backend. */
export const formatValue = (
  value: ChatCell,
  format: ValueFormat,
  locale: string,
): string => {
  if (format === "cents") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    }).format(Number(value) / 100);
  }
  return String(value);
};

export const eur = (cents: number) =>
  (cents / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

/**
 * Sesión en sessionStorage: se borra al cerrar la pestaña. El token se envía en el
 * encabezado Authorization; nunca se guarda en localStorage ni en cookies JavaScript.
 */

export type Session =
  | { role: "accountant"; token: string; username: string }
  | {
      role: "client";
      token: string;
      tenantId: string;
      mustChangePassword: boolean;
    };

export const loadSession = (): Session | null => {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

export const saveSession = (session: Session): void => {
  sessionStorage.setItem(KEY, JSON.stringify(session));
};

export const clearSession = (): void => {
  sessionStorage.removeItem(KEY);
};

export const changeLanguageOption = (lang: (typeof LANGUAGES)[number]) => {
  localStorage.setItem("ledger.lang", lang);
  void i18n.changeLanguage(lang);
};
