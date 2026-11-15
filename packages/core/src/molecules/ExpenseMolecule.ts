import Database from "better-sqlite3";
import { z } from "zod";
import { createLogger } from "../config/logger.js";
import type { IMolecule } from "./interfaces/IMolecule.js";
import {
  BTW_RATES,
  canAnnul,
  canClientModify,
  canDecide,
  validateRejectionNote,
  type BtwRate,
  type ExpenseCreator,
  type ExpenseState,
} from "../atoms/expenseRules.js";

const log = createLogger("ExpenseMolecule");

/** Categorías que se siembran al crear la base del cliente. La deducibilidad la confirma el contador. */
export const DEFAULT_CATEGORY_NAMES = [
  "Material de oficina",
  "Transporte",
  "Representación",
  "Seguros",
] as const;

export interface Category {
  id: number;
  nombre: string;
  /** null hasta que el contador confirme la deducibilidad. */
  deducible: boolean | null;
}

export interface Expense {
  id: number;
  fecha: string;
  importe_cents: number;
  tasa_btw: BtwRate;
  concepto: string;
  categoria_id: number;
  estado: ExpenseState;
  nota_rechazo: string | null;
  creado_por: ExpenseCreator;
  creado_en: string;
  revisado_por: string | null;
  revisado_en: string | null;
  referencia_archivo: string | null;
  /** Si el gasto tiene factura o recibo que lo respalde. */
  con_soporte: boolean;
  nota_anulacion: string | null;
  anulado_por: string | null;
  anulado_en: string | null;
}

/**
 * Datos de un gasto. El importe incluye el BTW, como aparece en el recibo, y va en céntimos.
 * `con_soporte` no se marca salvo que el cliente lo indique.
 */
export const ExpenseInputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha en formato AAAA-MM-DD"),
  importe_cents: z.number().int().positive(),
  tasa_btw: z.union([
    z.literal(BTW_RATES[0]),
    z.literal(BTW_RATES[1]),
    z.literal(BTW_RATES[2]),
  ]),
  concepto: z.string().trim().min(1).max(200),
  categoria_id: z.number().int().positive(),
  referencia_archivo: z.string().max(500).nullable().optional(),
  con_soporte: z.boolean().optional(),
});
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

/** Error de negocio con código, para que la ruta responda el estado HTTP correcto. */
export class ExpenseRuleError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "NOT_ALLOWED" | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "ExpenseRuleError";
  }
}

/** Definición completa de la tabla de gastos. Usada al crear y al reconstruir la tabla. */
const GASTOS_DDL = `
  CREATE TABLE gastos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha              TEXT    NOT NULL,
    importe_cents      INTEGER NOT NULL CHECK(importe_cents > 0),
    tasa_btw           INTEGER NOT NULL CHECK(tasa_btw IN (0, 9, 21)),
    concepto           TEXT    NOT NULL,
    categoria_id       INTEGER NOT NULL REFERENCES categorias(id),
    estado             TEXT    NOT NULL DEFAULT 'PENDIENTE'
                       CHECK(estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO')),
    nota_rechazo       TEXT    DEFAULT NULL,
    creado_por         TEXT    NOT NULL CHECK(creado_por IN ('ACCOUNTANT', 'CLIENT')),
    creado_en          TEXT    NOT NULL DEFAULT (datetime('now')),
    revisado_por       TEXT    DEFAULT NULL,
    revisado_en        TEXT    DEFAULT NULL,
    referencia_archivo TEXT    DEFAULT NULL,
    con_soporte        INTEGER NOT NULL DEFAULT 0 CHECK(con_soporte IN (0, 1)),
    nota_anulacion     TEXT    DEFAULT NULL,
    anulado_por        TEXT    DEFAULT NULL,
    anulado_en         TEXT    DEFAULT NULL
  )
`;

const GASTOS_COLUMNS =
  "id, fecha, importe_cents, tasa_btw, concepto, categoria_id, estado, nota_rechazo, creado_por, creado_en, revisado_por, revisado_en, referencia_archivo, con_soporte";

interface ExpenseRow extends Omit<Expense, "con_soporte"> {
  con_soporte: number;
}

function toExpense(row: ExpenseRow): Expense {
  return { ...row, con_soporte: row.con_soporte === 1 };
}

/**
 * Gastos y categorías de un cliente. Cada cliente tiene su propia base SQLite,
 * así que una instancia solo ve los datos de su tenant.
 */
export class ExpenseMolecule implements IMolecule {
  readonly name = "expenses";
  readonly version = "1.0.0";

  private db!: Database.Database;

  constructor(private readonly dbPath: string) {}

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
    log.debug({ path: this.dbPath }, "ExpenseMolecule inicializada");
  }

  async dispose(): Promise<void> {
    this.db?.close();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categorias (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre     TEXT    NOT NULL UNIQUE,
        deducible  INTEGER DEFAULT NULL CHECK(deducible IN (0, 1) OR deducible IS NULL),
        creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const tableSql = this.db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'gastos'",
      )
      .get() as { sql: string } | undefined;

    if (!tableSql) {
      this.db.exec(GASTOS_DDL);
    } else {
      this.migrateGastos(tableSql.sql);
    }
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos(estado)",
    );

    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM categorias")
      .get() as { n: number };
    if (count.n === 0) {
      const insert = this.db.prepare(
        "INSERT INTO categorias (nombre) VALUES (?)",
      );
      for (const nombre of DEFAULT_CATEGORY_NAMES) insert.run(nombre);
    }
  }

  /**
   * Bases creadas con una versión anterior. SQLite no cambia un CHECK con ALTER, así que
   * la tabla se reconstruye y se copian las filas. Sin soporte por defecto: hasta confirmarlo, no es deducible.
   */
  private migrateGastos(currentSql: string): void {
    const columns = this.db
      .prepare("PRAGMA table_info(gastos)")
      .all() as Array<{ name: string }>;
    const hasExpanded =
      currentSql.includes("'ANULADO'") &&
      columns.some((c) => c.name === "anulado_en");
    if (hasExpanded) return;

    this.db.transaction(() => {
      this.db.exec("ALTER TABLE gastos RENAME TO gastos_previo");
      this.db.exec(GASTOS_DDL);
      const previous = this.db
        .prepare("PRAGMA table_info(gastos_previo)")
        .all() as Array<{ name: string }>;
      const hasSupport = previous.some((c) => c.name === "con_soporte");
      this.db.exec(
        `INSERT INTO gastos (${GASTOS_COLUMNS})
         SELECT ${GASTOS_COLUMNS.split(", ")
           .map((c) => (c === "con_soporte" && !hasSupport ? "0" : c))
           .join(", ")}
         FROM gastos_previo`,
      );
      this.db.exec("DROP TABLE gastos_previo");
    })();
    log.info("Migración: tabla gastos reconstruida con estado ANULADO");
  }

  listCategories(): Category[] {
    const rows = this.db
      .prepare("SELECT id, nombre, deducible FROM categorias ORDER BY nombre")
      .all() as Array<{ id: number; nombre: string; deducible: number | null }>;
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      deducible: r.deducible === null ? null : r.deducible === 1,
    }));
  }

  /** El contador confirma o cambia la deducibilidad de una categoría. */
  setCategoryDeducible(categoryId: number, deducible: boolean): void {
    const info = this.db
      .prepare("UPDATE categorias SET deducible = ? WHERE id = ?")
      .run(deducible ? 1 : 0, categoryId);
    if (info.changes === 0) {
      throw new ExpenseRuleError("NOT_FOUND", "Categoría no encontrada");
    }
  }

  listExpenses(estado?: ExpenseState): Expense[] {
    const rows = (
      estado
        ? this.db
            .prepare(
              "SELECT * FROM gastos WHERE estado = ? ORDER BY fecha DESC, id DESC",
            )
            .all(estado)
        : this.db
            .prepare("SELECT * FROM gastos ORDER BY fecha DESC, id DESC")
            .all()
    ) as ExpenseRow[];
    return rows.map(toExpense);
  }

  getExpense(id: number): Expense | null {
    const row = this.db.prepare("SELECT * FROM gastos WHERE id = ?").get(id) as
      | ExpenseRow
      | undefined;
    return row ? toExpense(row) : null;
  }

  /** Alta de un gasto. El creador lo marca el servidor, no el cuerpo de la petición. */
  createExpense(input: ExpenseInput, creator: ExpenseCreator): Expense {
    const data = ExpenseInputSchema.parse(input);
    this.assertCategoryExists(data.categoria_id);
    const info = this.db
      .prepare(
        `INSERT INTO gastos (fecha, importe_cents, tasa_btw, concepto, categoria_id, creado_por, referencia_archivo, con_soporte)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.fecha,
        data.importe_cents,
        data.tasa_btw,
        data.concepto,
        data.categoria_id,
        creator,
        data.referencia_archivo ?? null,
        data.con_soporte ? 1 : 0,
      );
    return this.requireExpense(Number(info.lastInsertRowid));
  }

  /** Edición por el cliente. Solo gastos propios y pendientes. */
  updateExpenseByClient(id: number, input: ExpenseInput): Expense {
    const current = this.requireExpense(id);
    if (!canClientModify(current.estado, current.creado_por)) {
      throw new ExpenseRuleError(
        "NOT_ALLOWED",
        "Solo puedes editar tus gastos pendientes",
      );
    }
    return this.writeExpenseFields(id, input);
  }

  /** Corrección por el contador antes de decidir: tasa, importe, categoría o soporte. */
  updateExpenseByAccountant(id: number, input: ExpenseInput): Expense {
    const current = this.requireExpense(id);
    if (!canDecide(current.estado)) {
      throw new ExpenseRuleError("NOT_ALLOWED", "Este gasto ya fue decidido");
    }
    return this.writeExpenseFields(id, input);
  }

  private writeExpenseFields(id: number, input: ExpenseInput): Expense {
    const data = ExpenseInputSchema.parse(input);
    this.assertCategoryExists(data.categoria_id);
    this.db
      .prepare(
        `UPDATE gastos SET fecha = ?, importe_cents = ?, tasa_btw = ?, concepto = ?,
           categoria_id = ?, referencia_archivo = ?, con_soporte = ?
         WHERE id = ? AND estado = 'PENDIENTE'`,
      )
      .run(
        data.fecha,
        data.importe_cents,
        data.tasa_btw,
        data.concepto,
        data.categoria_id,
        data.referencia_archivo ?? null,
        data.con_soporte ? 1 : 0,
        id,
      );
    return this.requireExpense(id);
  }

  /**
   * Aprueba o rechaza un gasto pendiente. El rechazo exige nota. Una decisión es final.
   */
  decideExpense(
    id: number,
    decision: "APROBADO" | "RECHAZADO",
    reviewer: string,
    note?: string,
  ): Expense {
    const current = this.requireExpense(id);
    if (!canDecide(current.estado)) {
      throw new ExpenseRuleError("NOT_ALLOWED", "Este gasto ya fue decidido");
    }
    let nota: string | null = null;
    if (decision === "RECHAZADO") {
      const error = validateRejectionNote(note);
      if (error) throw new ExpenseRuleError("VALIDATION", error);
      nota = (note ?? "").trim();
    }
    this.db
      .prepare(
        `UPDATE gastos SET estado = ?, nota_rechazo = ?, revisado_por = ?, revisado_en = datetime('now')
         WHERE id = ? AND estado = 'PENDIENTE'`,
      )
      .run(decision, nota, reviewer, id);
    return this.requireExpense(id);
  }

  /**
   * Anula un gasto aprobado. Exige nota. El gasto deja de sumar en el estado de cuenta,
   * pero sigue visible con su motivo. Si hace falta, se registra de nuevo como gasto nuevo.
   */
  annulExpense(id: number, reviewer: string, note: string): Expense {
    const current = this.requireExpense(id);
    if (!canAnnul(current.estado)) {
      throw new ExpenseRuleError(
        "NOT_ALLOWED",
        "Solo se pueden anular gastos aprobados",
      );
    }
    const error = validateRejectionNote(note);
    if (error)
      throw new ExpenseRuleError(
        "VALIDATION",
        error.replace("rechazo", "anulación"),
      );
    this.db
      .prepare(
        `UPDATE gastos SET estado = 'ANULADO', nota_anulacion = ?, anulado_por = ?, anulado_en = datetime('now')
         WHERE id = ? AND estado = 'APROBADO'`,
      )
      .run(note.trim(), reviewer, id);
    return this.requireExpense(id);
  }

  private requireExpense(id: number): Expense {
    const expense = this.getExpense(id);
    if (!expense)
      throw new ExpenseRuleError("NOT_FOUND", "Gasto no encontrado");
    return expense;
  }

  private assertCategoryExists(categoryId: number): void {
    const row = this.db
      .prepare("SELECT 1 FROM categorias WHERE id = ?")
      .get(categoryId);
    if (!row)
      throw new ExpenseRuleError("VALIDATION", "Categoría no encontrada");
  }
}
