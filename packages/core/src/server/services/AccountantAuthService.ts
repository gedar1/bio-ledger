import jwt from "jsonwebtoken";
import type Database from "better-sqlite3";
import { z } from "zod";
import { createLogger } from "../../config/logger.js";
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
} from "./passwordHash.js";

const log = createLogger("AccountantAuthService");

const TOKEN_TTL = "8h";

/** Credenciales del contador. Usuario en minúsculas; contraseña de al menos 12 caracteres. */
export const AccountantCredentialsSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(64)
    .regex(
      /^[a-z0-9._-]+$/,
      "username: solo minúsculas, números, '.', '_' o '-'",
    ),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
});
export type AccountantCredentials = z.infer<typeof AccountantCredentialsSchema>;

export interface AuthenticatedAccountant {
  id: number;
  username: string;
}

/** Claims del token de contador. `kind` lo separa de los tokens de tenant y de plataforma. */
export interface AccountantTokenClaims {
  account_id: number;
  username: string;
}

export class AccountantExistsError extends Error {
  constructor() {
    super("Ya existe una cuenta de contador en este despliegue");
    this.name = "AccountantExistsError";
  }
}

function getPlatformSecret(): string {
  const secret = process.env.PLATFORM_SECRET;
  if (!secret) {
    throw new Error("PLATFORM_SECRET no configurado");
  }
  return secret;
}

/**
 * Cuenta del contador del estudio. Solo puede existir una, porque cada despliegue
 * es de un solo estudio con un solo contador.
 */
export class AccountantAuthService {
  constructor(private readonly db: Database.Database) {}

  hasAccountant(): boolean {
    return (
      this.db.prepare("SELECT 1 FROM platform_accounts LIMIT 1").get() !==
      undefined
    );
  }

  /** Crea la cuenta del contador. Falla si ya existe una. */
  async createAccountant(
    input: AccountantCredentials,
  ): Promise<AuthenticatedAccountant> {
    const credentials = AccountantCredentialsSchema.parse(input);
    if (this.hasAccountant()) {
      throw new AccountantExistsError();
    }
    const passwordHash = await hashPassword(credentials.password);
    const info = this.db
      .prepare(
        "INSERT INTO platform_accounts (username, password_hash) VALUES (?, ?)",
      )
      .run(credentials.username, passwordHash);
    log.info({ username: credentials.username }, "Cuenta de contador creada");
    return { id: Number(info.lastInsertRowid), username: credentials.username };
  }

  /** Verifica usuario y contraseña. Devuelve null si no coinciden, sin indicar cuál falló. */
  async authenticate(
    username: string,
    password: string,
  ): Promise<AuthenticatedAccountant | null> {
    const row = this.db
      .prepare(
        "SELECT id, username, password_hash FROM platform_accounts WHERE username = ?",
      )
      .get(username) as
      | { id: number; username: string; password_hash: string }
      | undefined;
    if (!row) return null;
    const ok = await verifyPassword(password, row.password_hash);
    return ok ? { id: row.id, username: row.username } : null;
  }

  /** Emite un JWT de contador firmado con PLATFORM_SECRET. Vence en 8 horas. */
  issueToken(account: AuthenticatedAccountant): string {
    const claims: AccountantTokenClaims & { kind: "accountant" } = {
      kind: "accountant",
      account_id: account.id,
      username: account.username,
    };
    return jwt.sign(claims, getPlatformSecret(), { expiresIn: TOKEN_TTL });
  }

  /** Valida un JWT de contador. Devuelve null si no es válido o no es de contador. */
  static verifyToken(token: string): AccountantTokenClaims | null {
    try {
      const payload = jwt.verify(token, getPlatformSecret()) as jwt.JwtPayload;
      if (
        payload.kind !== "accountant" ||
        typeof payload.account_id !== "number"
      ) {
        return null;
      }
      return {
        account_id: payload.account_id,
        username: String(payload.username ?? ""),
      };
    } catch {
      return null;
    }
  }
}
