import {
  DEFAULT_TENANT_PROFILE,
  registerDomainProfile,
  type ProfileConfig,
} from "./profileRegistry.js";
import {
  LEDGER_ACCOUNTANT_CELL,
  LEDGER_CLIENT_CELL,
} from "./ledgerCellTypes.js";
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
      avoidTerms: [
        "aprobad", "pendient", "rechazad", "anulad", "estado",
        "goedgekeurd", "behandeling", "afgewezen", "geannuleerd",
        "approved", "pending", "rejected", "cancelled", "canceled",
      ],
      description: "Lista los gastos del cliente",
      steps: [{ cell: LEDGER_CLIENT_CELL, tool: "list_my_expenses", args: {} }],
      requires: [],
      setup: [],
      view: "table",
      respond: "tool",
      done: "Estos son tus gastos.",
    },
    {
      id: "gastos-por-estado",
      description: "Gastos del cliente en un estado: aprobados, pendientes, rechazados o anulados",
      requires: [
        {
          name: "estado",
          extractor: "estado",
          ask: "¿Qué estado quieres ver: aprobados, pendientes, rechazados o anulados?",
        },
      ],
      setup: [],
      steps: [
        {
          cell: LEDGER_CLIENT_CELL,
          tool: "list_my_expenses",
          args: { estado: "$requires.estado" },
        },
      ],
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
      view: "card",
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
      view: "card",
      respond: "tool",
      done: "Este es tu estado de cuenta.",
    },
    {
      id: "gasto-por-mes",
      description: "Gasto del cliente por mes del año en curso, en tabla",
      requires: [],
      setup: [],
      steps: [{ cell: LEDGER_CLIENT_CELL, tool: "get_my_monthly_totals", args: {} }],
      respond: "tool",
      view: "table",
      done: "Te muestro tu gasto por mes en la tabla.",
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
      view: "table",
      done: "Te muestro el detalle por categoría en la tabla.",
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
/**
 * Perfil del tenant: células del producto y prompt neutral. Los roles eligen su perfil de chat
 * en cada petición; este es el que usa el cortex por defecto del tenant (TENANT_PROFILE).
 */
export const ledgerTenantProfile: ProfileConfig = {
  allowedCells: [LEDGER_CLIENT_CELL, LEDGER_ACCOUNTANT_CELL],
  agentFile: "config/ledger-agent.md",
  description: "Aplicación contable: células del cliente y del contador",
  chains: [],
};

export function registerLedgerProfiles(): void {
  registerDomainProfile(DEFAULT_TENANT_PROFILE, ledgerTenantProfile);
  registerDomainProfile(LEDGER_CLIENT_PROFILE, ledgerClientProfile);
  registerDomainProfile(LEDGER_ACCOUNTANT_PROFILE, ledgerAccountantProfile);
}
