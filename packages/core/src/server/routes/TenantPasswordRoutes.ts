import { z } from "zod";
import { createLogger } from "../../config/logger.js";
import type { HealthServer } from "../HealthServer.js";
import type { LoginRateLimiter } from "../middleware/loginRateLimiter.js";
import { resolveRequestAuth } from "../middleware/tenantAuth.js";
import type { TenantAuthService } from "../services/TenantAuthService.js";
import { MIN_PASSWORD_LENGTH } from "../services/passwordHash.js";
import { successEnvelope, errorEnvelope } from "../utils/apiEnvelope.js";

const log = createLogger("TenantPasswordRoutes");

const PasswordLoginSchema = z.object({
  tenant_id: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

const ChangePasswordSchema = z.object({
  new_password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
});

interface TenantPasswordResponse {
  _statusCode: number;
  body: unknown;
}

function respond(statusCode: number, body: unknown): TenantPasswordResponse {
  return { _statusCode: statusCode, body };
}

/**
 * Login y cambio de contraseña del cliente.
 *
 *   POST /api/tenant/auth/password-login  — usuario (tenant_id) y contraseña; público, con límite de intentos.
 *   POST /api/tenant/auth/change-password — con token de cliente; fija la contraseña propia.
 */
export function setupTenantPasswordRoutes(
  health: HealthServer,
  authService: TenantAuthService,
  rateLimiter: LoginRateLimiter,
): void {
  health.registerData("tenant/auth/password-login", async (params?: unknown) => {
    const parsed = PasswordLoginSchema.safeParse(params);
    if (!parsed.success) {
      return respond(
        422,
        errorEnvelope("VALIDATION_ERROR", "Usuario y contraseña requeridos"),
      );
    }

    const { tenant_id, password } = parsed.data;
    const identifier = tenant_id;

    if (!rateLimiter.isAllowed(identifier)) {
      const retryAfter = rateLimiter.getRetryAfterSeconds(identifier);
      log.warn({ tenantId: tenant_id }, "Login de cliente limitado por intentos");
      return respond(
        429,
        errorEnvelope(
          "RATE_LIMITED",
          "Demasiados intentos fallidos. Intenta más tarde.",
          { retry_after: retryAfter },
        ),
      );
    }

    const result = await authService.passwordLogin(tenant_id, password);
    if ("error" in result) {
      rateLimiter.recordFailure(identifier);
      const code = result.status === 403 ? "TENANT_INACTIVE" : "AUTH_INVALID_CREDENTIALS";
      return respond(result.status, errorEnvelope(code, result.error));
    }

    rateLimiter.reset(identifier);
    return respond(200, successEnvelope(result));
  });

  health.registerData("tenant/auth/change-password", async (params?: unknown) => {
    const body = (params ?? {}) as Record<string, unknown>;
    const header = body._authHeader as string | undefined;
    const ctx = resolveRequestAuth(header, authService);
    if ("error" in ctx || ctx.auth_type !== "tenant_jwt") {
      return respond(401, errorEnvelope("AUTH_INVALID_TOKEN", "Se requiere token de cliente"));
    }

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return respond(
        422,
        errorEnvelope(
          "VALIDATION_ERROR",
          `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        ),
      );
    }

    const issued = await authService.setOwnPassword(ctx.tenant_id, parsed.data.new_password);
    if (!issued) {
      return respond(404, errorEnvelope("TENANT_NOT_FOUND", "Cliente no encontrado"));
    }
    return respond(200, successEnvelope(issued));
  });
}
