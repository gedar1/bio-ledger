import { registerDomainProfile, type ProfileConfig } from "./profileRegistry.js";
import { LEDGER_ACCOUNTANT_CELL, LEDGER_CLIENT_CELL } from "./ledgerComposition.js";
import { LEDGER_ACCOUNTANT_PROFILE, LEDGER_CLIENT_PROFILE } from "../atoms/chatProfiles.js";

/**
 * Perfiles del chat según el rol. Cada uno solo ve sus células de lectura: ninguno
 * incluye `memory`, así que el LLM no recibe herramientas SQL genéricas.
 */
export const ledgerClientProfile: ProfileConfig = {
  allowedCells: [LEDGER_CLIENT_CELL],
  agentFile: "config/ledger-agent-cliente.md",
  description: "Asistente del cliente: sus gastos y su estado de cuenta",
  chains: [
    {
      id: "mis-gastos",
      description: "Lista los gastos del cliente",
      steps: [{ cell: LEDGER_CLIENT_CELL, tool: "list_my_expenses", args: {} }],
      requires: [],
      setup: [],
      respond: "tool",
      done: "Estos son tus gastos.",
    },
  ],
};

export const ledgerAccountantProfile: ProfileConfig = {
  allowedCells: [LEDGER_ACCOUNTANT_CELL],
  agentFile: "config/ledger-agent-contador.md",
  description: "Asistente del contador: revisión de gastos y estado de cuenta del cliente seleccionado",
  chains: [
    {
      id: "gastos-pendientes",
      description: "Lista los gastos pendientes de revisión del cliente",
      steps: [{ cell: LEDGER_ACCOUNTANT_CELL, tool: "list_pending_expenses", args: {} }],
      requires: [],
      setup: [],
      respond: "tool",
      done: "Estos son los gastos pendientes.",
    },
  ],
};

/** Registra los perfiles del chat contable. Llamar una vez al arrancar el servidor. */
export function registerLedgerProfiles(): void {
  registerDomainProfile(LEDGER_CLIENT_PROFILE, ledgerClientProfile);
  registerDomainProfile(LEDGER_ACCOUNTANT_PROFILE, ledgerAccountantProfile);
}
