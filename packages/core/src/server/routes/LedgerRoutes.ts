import { join } from "node:path";
import { z, ZodError } from "zod";
import { createLogger } from "../../config/logger.js";
import type { HealthServer } from "../HealthServer.js";
import { resolveRequestAuth } from "../middleware/tenantAuth.js";
import { AccountantAuthService } from "../services/AccountantAuthService.js";
import type { TenantAuthService } from "../services/TenantAuthService.js";
import {
  ExpenseInputSchema,
  ExpenseMolecule,
  ExpenseRuleError,
} from "../../molecules/ExpenseMolecule.js";
import { successEnvelope, errorEnvelope } from "../utils/apiEnvelope.js";
import { buildStatement, parsePeriod } from "../../atoms/statement.js";

const log = createLogger("LedgerRoutes");

const TENANT_ID = /^[a-z0-9-]+$/;

/** Cierra las bases de clientes abiertas por las rutas. */
export interface LedgerRoutesHandle {
  dispose(): Promise<void>;
}

interface LedgerResponse {
  _statusCode: number;
  body: unknown;
}

function respond(statusCode: number, body: unknown): LedgerResponse {
  return { _statusCode: statusCode, body };
}

const DecideSchema = z.object({
  id: z.number().int().positive(),
  decision: z.enum(["APROBADO", "RECHAZADO"]),
  note: z.string().max(500).optional(),
});

const IdSchema = z.object({ id: z.number().int().positive() });

const PeriodSchema = z.object({ periodo: z.string() });

const CategoryDeducibleSchema = z.object({
  categoria_id: z.number().int().positive(),
  deducible: z.boolean(),
});

/** Convierte un error de negocio o de validación en respuesta HTTP. */
function failure(error: unknown): LedgerResponse {
  if (error instanceof ExpenseRuleError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_ALLOWED" ? 409 : 422;
    return respond(status, errorEnvelope(error.code, error.message));
  }
  if (error instanceof ZodError) {
    return respond(
      422,
      errorEnvelope("VALIDATION_ERROR", "Datos del gasto no válidos", {
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }),
    );
  }
  throw error;
}

/**
 * Registro de gastos y categorías.
 *
 * Cliente (token de cliente, su propia base):
 *   ledger/categories/list, ledger/expenses/list, ledger/expenses/create, ledger/expenses/update
 *
 * Contador (token de contador, solo clientes de su cuenta):
 *   ledger/accountant/expenses/list, ledger/accountant/expenses/create, ledger/accountant/expenses/decide
 *
 * Cada cliente tiene su base SQLite en `<dataDir>/tenants/<tenant>.db`. Las consultas
 * del cliente usan el tenant del token; las del contador validan la propiedad antes.
 */
export function setupLedgerRoutes(
  health: HealthServer,
  tenantAuthService: TenantAuthService,
  dataDir: string,
): LedgerRoutesHandle {
  const stores = new Map<string, ExpenseMolecule>();

  async function storeFor(tenantId: string): Promise<ExpenseMolecule> {
    if (!TENANT_ID.test(tenantId)) {
      throw new ExpenseRuleError("NOT_FOUND", "Cliente no encontrado");
    }
    const cached = stores.get(tenantId);
    if (cached) return cached;
    const store = new ExpenseMolecule(join(dataDir, "tenants", `${tenantId}.db`));
    await store.initialize();
    stores.set(tenantId, store);
    return store;
  }

  /** Tenant del token de cliente, o null si el token no es de cliente. */
  function clientTenant(header: unknown): string | null {
    if (typeof header !== "string") return null;
    const ctx = resolveRequestAuth(header, tenantAuthService);
    return !("error" in ctx) && ctx.auth_type === "tenant_jwt" ? ctx.tenant_id : null;
  }

  /** Tenant del contador: el token debe ser de contador y el cliente debe pertenecerle. */
  function accountantTenant(header: unknown, tenantId: unknown): string | null {
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
    const claims = AccountantAuthService.verifyToken(header.slice(7));
    if (!claims || typeof tenantId !== "string") return null;
    return tenantAuthService.accountOwnsTenant(claims.account_id, tenantId) ? tenantId : null;
  }

  const unauthorized = () =>
    respond(401, errorEnvelope("AUTH_INVALID_TOKEN", "Token no válido para este recurso"));
  const notFound = () => respond(404, errorEnvelope("TENANT_NOT_FOUND", "Cliente no encontrado"));

  // ─── Cliente ──────────────────────────────────────────────────────────────

  health.registerData("ledger/categories/list", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = clientTenant(body._authHeader);
    if (!tenantId) return unauthorized();
    const store = await storeFor(tenantId);
    return respond(200, successEnvelope({ categories: store.listCategories() }));
  });

  health.registerData("ledger/expenses/list", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = clientTenant(body._authHeader);
    if (!tenantId) return unauthorized();
    const store = await storeFor(tenantId);
    return respond(200, successEnvelope({ expenses: store.listExpenses() }));
  });

  health.registerData("ledger/expenses/create", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = clientTenant(body._authHeader);
    if (!tenantId) return unauthorized();
    try {
      const store = await storeFor(tenantId);
      const expense = store.createExpense(ExpenseInputSchema.parse(body), "CLIENT");
      return respond(201, successEnvelope({ expense }));
    } catch (error: unknown) {
      return failure(error);
    }
  });

  health.registerData("ledger/expenses/update", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = clientTenant(body._authHeader);
    if (!tenantId) return unauthorized();
    try {
      const id = IdSchema.parse(body).id;
      const store = await storeFor(tenantId);
      const expense = store.updateExpenseByClient(id, ExpenseInputSchema.parse(body));
      return respond(200, successEnvelope({ expense }));
    } catch (error: unknown) {
      return failure(error);
    }
  });

  // ─── Contador ─────────────────────────────────────────────────────────────

  health.registerData("ledger/accountant/expenses/list", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    const store = await storeFor(tenantId);
    return respond(200, successEnvelope({ tenant_id: tenantId, expenses: store.listExpenses() }));
  });

  health.registerData("ledger/accountant/expenses/create", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    try {
      const store = await storeFor(tenantId);
      const expense = store.createExpense(ExpenseInputSchema.parse(body), "ACCOUNTANT");
      return respond(201, successEnvelope({ expense }));
    } catch (error: unknown) {
      return failure(error);
    }
  });

  health.registerData("ledger/accountant/expenses/decide", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    try {
      const input = DecideSchema.parse(body);
      const store = await storeFor(tenantId);
      const expense = store.decideExpense(input.id, input.decision, "contador", input.note);
      log.info({ tenantId, id: input.id, decision: input.decision }, "Gasto decidido");
      return respond(200, successEnvelope({ expense }));
    } catch (error: unknown) {
      return failure(error);
    }
  });
  // ─── Estado de cuenta ─────────────────────────────────────────────────────

  health.registerData("ledger/statement", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = clientTenant(body._authHeader);
    if (!tenantId) return unauthorized();
    return statementResponse(tenantId, body.periodo);
  });

  health.registerData("ledger/accountant/statement", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    return statementResponse(tenantId, body.periodo);
  });

  health.registerData("ledger/accountant/expenses/update", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    try {
      const id = IdSchema.parse(body).id;
      const store = await storeFor(tenantId);
      const expense = store.updateExpenseByAccountant(id, ExpenseInputSchema.parse(body));
      return respond(200, successEnvelope({ expense }));
    } catch (error: unknown) {
      return failure(error);
    }
  });

  health.registerData("ledger/accountant/categories/deducible", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const tenantId = accountantTenant(body._authHeader, body.tenant_id);
    if (!tenantId) return notFound();
    try {
      const input = CategoryDeducibleSchema.parse(body);
      const store = await storeFor(tenantId);
      store.setCategoryDeducible(input.categoria_id, input.deducible);
      return respond(200, successEnvelope({ categories: store.listCategories() }));
    } catch (error: unknown) {
      return failure(error);
    }
  });

  /** Estado de cuenta de un periodo. Los totales son solo de gastos aprobados. */
  async function statementResponse(tenantId: string, periodo: unknown): Promise<LedgerResponse> {
    const parsed = PeriodSchema.safeParse({ periodo });
    const period = parsed.success ? parsePeriod(parsed.data.periodo) : null;
    if (!period) {
      return respond(
        422,
        errorEnvelope("VALIDATION_ERROR", "Periodo no válido. Usa AAAA-MM o AAAA-Tn (T1 a T4)"),
      );
    }
    const store = await storeFor(tenantId);
    const statement = buildStatement(period, store.listExpenses(), store.listCategories());
    return respond(200, successEnvelope({ statement }));
  }

  return {
    dispose: async () => {
      await Promise.all([...stores.values()].map((store) => store.dispose()));
      stores.clear();
    },
  };
}
