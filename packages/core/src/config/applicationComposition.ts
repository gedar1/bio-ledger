import { loadApplicationRegistry } from "./mergeRegistry.js";
import {
  LEDGER_ACCOUNTANT_CELL,
  LEDGER_CLIENT_CELL,
  ledgerRegistrations,
} from "../domain/ledger/ledgerComposition.js";
import type { CellComposition } from "../cells/CellComposition.js";

const applicationRegistry = loadApplicationRegistry();

/**
 * Composition root de la aplicación. Ensambla el registry y las células del producto.
 */
export function createApplicationComposition(): CellComposition {
  return {
    registry: applicationRegistry,
    allowedCells: [LEDGER_CLIENT_CELL, LEDGER_ACCOUNTANT_CELL],
    registrations: [...ledgerRegistrations],
  };
}
