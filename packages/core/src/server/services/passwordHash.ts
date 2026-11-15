import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** Contraseña mínima para cuentas de contador y de cliente. */
export const MIN_PASSWORD_LENGTH = 12;

/** Hash scrypt con sal aleatoria. Formato: `salt:derivedKey` en hex. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Compara una contraseña con un hash guardado en tiempo constante. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/**
 * Contraseña temporal para dar de alta o restablecer un cliente.
 * 9 bytes aleatorios en base64url: 12 caracteres, sin símbolos que confundan al leerla.
 */
export function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}
