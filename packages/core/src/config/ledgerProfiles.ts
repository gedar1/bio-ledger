import {
  registerDomainProfile,
  type ProfileConfig,
} from "./profileRegistry.js";
import {
  LEDGER_ACCOUNTANT_CELL,
  LEDGER_CLIENT_CELL,
} from "../domain/ledger/ledgerComposition.js";
import {
  LEDGER_ACCOUNTANT_PROFILE,
  LEDGER_CLIENT_PROFILE,
} from "../atoms/chatProfiles.js";

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
    {
      id: "estado-de-cuenta-mes",
      description: "Estado de cuenta del mes actual del cliente",
      requires: [],
      setup: [],
      steps: [
        { cell: LEDGER_CLIENT_CELL, tool: "get_my_month_statement", args: {} },
      ],
      respond: "tool",
      done: "Este es tu estado de cuenta del mes.",
    },
    {
      id: "estado-de-cuenta",
      description:
        "Estado de cuenta del cliente para un mes o trimestre indicado",
      requires: [
        {
          name: "periodo",
          extractor: "periodo",
          ask: "¿De qué mes o trimestre quieres el estado de cuenta?",
        },
      ],
      setup: [],
      steps: [
        {
          cell: LEDGER_CLIENT_CELL,
          tool: "get_my_statement",
          args: { periodo: "$requires.periodo" },
        },
      ],
      respond: "tool",
      done: "Este es tu estado de cuenta.",
    },
    {
      id: "mis-categorias",
      description: "Lista las categorías de gasto del cliente",
      requires: [],
      setup: [],
      steps: [
        { cell: LEDGER_CLIENT_CELL, tool: "list_my_categories", args: {} },
      ],
      respond: "tool",
      done: "Estas son tus categorías de gasto actuales.",
    },
    {
      id: "gasto-por-categoria-mes",
      description: "Gasto del cliente por categoría en el mes actual",
      requires: [],
      setup: [],
      steps: [
        {
          cell: LEDGER_CLIENT_CELL,
          tool: "get_my_month_category_totals",
          args: {},
        },
      ],
      respond: "tool",
      done: "Este es tu gasto por categoría del mes.",
    },
    {
      id: "gasto-por-categoria-periodo",
      description:
        "Gasto del cliente por categoría en un mes o trimestre indicado",
      requires: [
        {
          name: "periodo",
          extractor: "periodo",
          ask: "¿De qué mes o trimestre quieres el gasto por categoría?",
        },
      ],
      setup: [],
      steps: [
        {
          cell: LEDGER_CLIENT_CELL,
          tool: "get_my_category_totals",
          args: { periodo: "$requires.periodo" },
        },
      ],
      respond: "tool",
      done: "Este es tu gasto por categoría del periodo.",
    },
    {
      id: "gasto-mas-caro",
      description:
        "Gasto de mayor importe del cliente en un mes o trimestre indicado",
      requires: [
        {
          name: "periodo",
          extractor: "periodo",
          ask: "¿De qué mes o trimestre quieres saber tu gasto más caro?",
        },
      ],
      setup: [],
      steps: [
        {
          cell: LEDGER_CLIENT_CELL,
          tool: "get_my_largest_expense",
          args: { periodo: "$requires.periodo" },
        },
      ],
      respond: "tool",
      done: "Este es tu gasto más caro del periodo.",
    },
  ],
};

export const ledgerAccountantProfile: ProfileConfig = {
  allowedCells: [LEDGER_ACCOUNTANT_CELL],
  agentFile: "config/ledger-agent-contador.md",
  description:
    "Asistente del contador: revisión de gastos y estado de cuenta del cliente seleccionado",
  chains: [
    {
      id: "gastos-pendientes",
      description: "Lista los gastos pendientes de revisión del cliente",
      steps: [
        {
          cell: LEDGER_ACCOUNTANT_CELL,
          tool: "list_pending_expenses",
          args: {},
        },
      ],
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
