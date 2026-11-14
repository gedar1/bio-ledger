/**
 * Crea la cuenta del contador del despliegue. Se ejecuta una sola vez.
 *
 *   pnpm exec tsx packages/core/scripts/create-accountant.ts
 *
 * Pide usuario y contraseña en la terminal. La contraseña no se muestra al escribirla.
 * Si ya existe una cuenta, el script termina sin cambios. Para cambiar la contraseña
 * hay que hacerlo desde la base, porque este script no reemplaza cuentas.
 */
import { Writable } from "node:stream";
import { createInterface } from "node:readline/promises";
import Database from "better-sqlite3";
import { resolveDataPath } from "../src/atoms/paths.js";
import { initializePlatformSchema } from "../src/server/services/platformSchema.js";
import {
  AccountantAuthService,
  AccountantExistsError,
} from "../src/server/services/AccountantAuthService.js";

async function main(): Promise<void> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });

  try {
    const username = (
      await rl.question("Usuario (minúsculas, sin espacios): ")
    ).trim();
    process.stdout.write("Contraseña (mínimo 12 caracteres, no se muestra): ");
    muted = true;
    const password = await rl.question("");
    muted = false;
    process.stdout.write("\n");

    const dbPath = resolveDataPath(
      process.env.DATABASE_PATH || "./data/biocore.db",
    );
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initializePlatformSchema(db);

    try {
      const service = new AccountantAuthService(db);
      const account = await service.createAccountant({ username, password });
      console.log(`Cuenta de contador creada: ${account.username}`);
    } catch (error: unknown) {
      if (error instanceof AccountantExistsError) {
        console.error("No se creó nada: ya existe una cuenta de contador.");
        process.exitCode = 1;
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`No se creó la cuenta: ${message}`);
        process.exitCode = 1;
      }
    } finally {
      db.close();
    }
  } finally {
    rl.close();
  }
}

void main();
