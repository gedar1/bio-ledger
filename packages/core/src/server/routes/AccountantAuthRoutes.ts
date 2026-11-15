import { z } from "zod";
import { createLogger } from "../../config/logger.js";
import type { HealthServer } from "../HealthServer.js";
import type { LoginRateLimiter } from "../middleware/loginRateLimiter.js";
import { AccountantAuthService } from "../services/AccountantAuthService.js";
import {
  CreateTenantSchema,
  type TenantRegistryService,
} from "../services/TenantRegistryService.js";
import type { TenantAuthService } from "../services/TenantAuthService.js";
import { successEnvelope, errorEnvelope } from "../utils/apiEnvelope.js";

const log = createLogger("AccountantAuthRoutes");

const AccountantLoginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

/** Respuesta con código HTTP, igual que las rutas de tenant. */
interface AccountantResponse {
  _statusCode: number;
  body: unknown;
}

function respond(statusCode: number, body: unknown): AccountantResponse {
  return { _statusCode: statusCode, body };
}

/** Claims del token de contador desde el header Authorization, o null. */
function accountantClaims(header: unknown) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return AccountantAuthService.verifyToken(header.slice(7));
}

/**
 * Login del contador.
 *
 *   POST /api/accountant/auth/login — usuario y contraseña; devuelve un JWT de 8 horas.
 *
 * Público: la ruta no exige token. Tiene límite de intentos por usuario.
 */
export function setupAccountantAuthRoutes(
  health: HealthServer,
  authService: AccountantAuthService,
  rateLimiter: LoginRateLimiter,
): void {
  health.registerData("accountant/auth/login", async (params?: unknown) => {
    const parsed = AccountantLoginSchema.safeParse(params);
    if (!parsed.success) {
      return respond(
        422,
        errorEnvelope("VALIDATION_ERROR", "Usuario y contraseña requeridos"),
      );
    }

    const { username, password } = parsed.data;
    const identifier = username.toLowerCase();

    if (!rateLimiter.isAllowed(identifier)) {
      const retryAfter = rateLimiter.getRetryAfterSeconds(identifier);
      log.warn("Login de contador limitado por intentos");
      return respond(
        429,
        errorEnvelope(
          "RATE_LIMITED",
          "Demasiados intentos fallidos. Intenta más tarde.",
          { retry_after: retryAfter },
        ),
      );
    }

    const account = await authService.authenticate(identifier, password);
    if (!account) {
      rateLimiter.recordFailure(identifier);
      return respond(
        401,
        errorEnvelope(
          "AUTH_INVALID_CREDENTIALS",
          "Usuario o contraseña incorrectos",
        ),
      );
    }

    rateLimiter.reset(identifier);
    return respond(
      200,
      successEnvelope({
        token: authService.issueToken(account),
        username: account.username,
        role: "accountant",
        expires_in: 8 * 60 * 60,
      }),
    );
  });
}

/**
 * Alta y restablecimiento de clientes por el contador.
 *
 *   POST /api/accountant/tenants                     — crea el cliente con contraseña temporal.
 *   POST /api/accountant/tenants/reset-password      — genera una contraseña temporal nueva.
 *
 * El dueño sale del token. Las contraseñas temporales se devuelven una sola vez y
 * obligan al cliente a cambiarlas en su siguiente inicio de sesión.
 */
export function setupAccountantTenantRoutes(
  health: HealthServer,
  registry: TenantRegistryService,
  tenantAuthService: TenantAuthService,
): void {
  health.registerData("accountant/tenants", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const claims = accountantClaims(body._authHeader);
    if (!claims) {
      return respond(
        401,
        errorEnvelope("AUTH_INVALID_TOKEN", "Token de contador no válido"),
      );
    }

    const parsed = CreateTenantSchema.safeParse({
      tenant_id: body.tenant_id,
      display_name: body.display_name,
      profile: body.profile ?? "domain",
    });
    if (!parsed.success) {
      return respond(
        422,
        errorEnvelope("VALIDATION_ERROR", "Datos del cliente no válidos", {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        }),
      );
    }

    if (registry.exists(parsed.data.tenant_id)) {
      return respond(
        409,
        errorEnvelope(
          "TENANT_ALREADY_EXISTS",
          `El cliente '${parsed.data.tenant_id}' ya existe`,
        ),
      );
    }

    const record = registry.create({
      ...parsed.data,
      owner_id: String(claims.account_id),
    });
    const tempPassword = await tenantAuthService.resetTempPassword(
      record.tenant_id,
    );

    log.info({ tenantId: record.tenant_id }, "Cliente creado por el contador");
    return respond(
      201,
      successEnvelope({
        tenant_id: record.tenant_id,
        display_name: record.display_name,
        owner_id: record.owner_id,
        temp_password: tempPassword,
        must_change_password: true,
      }),
    );
  });

  health.registerData(
    "accountant/tenants/reset-password",
    async (params?: unknown) => {
      const body = (params ?? {}) as Record<string, unknown>;
      const claims = accountantClaims(body._authHeader);
      if (!claims) {
        return respond(
          401,
          errorEnvelope("AUTH_INVALID_TOKEN", "Token de contador no válido"),
        );
      }

      const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
      // Mismo mensaje para "no existe" y "no es tuyo", para no revelar qué clientes hay.
      if (
        !tenantId ||
        !tenantAuthService.accountOwnsTenant(claims.account_id, tenantId)
      ) {
        return respond(
          404,
          errorEnvelope("TENANT_NOT_FOUND", "Cliente no encontrado"),
        );
      }

      const tempPassword = await tenantAuthService.resetTempPassword(tenantId);
      if (!tempPassword) {
        return respond(
          404,
          errorEnvelope("TENANT_NOT_FOUND", "Cliente no encontrado"),
        );
      }

      log.info(
        { tenantId },
        "Contraseña temporal restablecida por el contador",
      );
      return respond(
        200,
        successEnvelope({
          tenant_id: tenantId,
          temp_password: tempPassword,
          must_change_password: true,
        }),
      );
    },
  );
}
