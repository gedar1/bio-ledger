export const LANGUAGES = ["nl", "es", "en"] as const;

/** Locale de número y moneda según el idioma de la interfaz. */
export const LOCALE: Record<string, string> = {
  nl: "nl-NL",
  es: "es-ES",
  en: "en-GB",
};

export const VAT_RATES = [0, 9, 21] as const;

export type Tab = "accountant" | "client";

export const KEY = "ledger.session";
