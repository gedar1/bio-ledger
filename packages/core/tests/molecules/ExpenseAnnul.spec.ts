import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExpenseMolecule, ExpenseRuleError, type ExpenseInput } from "../../src/molecules/ExpenseMolecule.js";
import { canAnnul } from "../../src/atoms/expenseRules.js";
import { buildStatement, parsePeriod } from "../../src/atoms/statement.js";

const input = (categoria_id: number): ExpenseInput => ({
  fecha: "2025-03-10",
  importe_cents: 12100,
  tasa_btw: 21,
  concepto: "Papel",
  categoria_id,
  con_soporte: true,
});

describe("anulación de gastos aprobados", () => {
  let dir: string;
  let store: ExpenseMolecule;
  let categoryId: number;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "annul-"));
    store = new ExpenseMolecule(join(dir, "cliente.db"));
    await store.initialize();
    categoryId = store.listCategories()[0].id;
  });

  afterEach(async () => {
    await store.dispose();
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("solo un gasto aprobado puede anularse", () => {
    expect(canAnnul("APROBADO")).toBe(true);
    expect(canAnnul("PENDIENTE")).toBe(false);
    expect(canAnnul("RECHAZADO")).toBe(false);
    expect(canAnnul("ANULADO")).toBe(false);
  });

  it("anula con nota y deja el motivo y el autor", () => {
    const expense = store.createExpense(input(categoryId), "CLIENT");
    store.decideExpense(expense.id, "APROBADO", "contador");

    const annulled = store.annulExpense(expense.id, "contador", "Factura duplicada");

    expect(annulled.estado).toBe("ANULADO");
    expect(annulled.nota_anulacion).toBe("Factura duplicada");
    expect(annulled.anulado_por).toBe("contador");
    expect(annulled.anulado_en).not.toBeNull();
  });

  it("no anula sin nota ni un gasto pendiente", () => {
    const pending = store.createExpense(input(categoryId), "CLIENT");
    expect(() => store.annulExpense(pending.id, "contador", "motivo")).toThrow(ExpenseRuleError);

    store.decideExpense(pending.id, "APROBADO", "contador");
    expect(() => store.annulExpense(pending.id, "contador", " ")).toThrow(ExpenseRuleError);
  });

  it("un gasto anulado sale del estado de cuenta, pero se cuenta aparte", () => {
    const expense = store.createExpense(input(categoryId), "CLIENT");
    store.decideExpense(expense.id, "APROBADO", "contador");
    store.annulExpense(expense.id, "contador", "Error de importe");

    const statement = buildStatement(parsePeriod("2025-03")!, store.listExpenses(), store.listCategories());

    expect(statement.aprobados.total_cents).toBe(0);
    expect(statement.anulados).toEqual({ cantidad: 1, total_cents: 12100 });
  });
});

describe("migración de bases anteriores", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "annul-migra-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("reconstruye la tabla con ANULADO y conserva los gastos existentes", async () => {
    const path = join(dir, "vieja.db");
    const old = new Database(path);
    // Esquema anterior: sin ANULADO y sin columnas de anulación.
    old.exec(`
      CREATE TABLE categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        deducible INTEGER DEFAULT NULL,
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE gastos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        importe_cents INTEGER NOT NULL CHECK(importe_cents > 0),
        tasa_btw INTEGER NOT NULL CHECK(tasa_btw IN (0, 9, 21)),
        concepto TEXT NOT NULL,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id),
        estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
        nota_rechazo TEXT DEFAULT NULL,
        creado_por TEXT NOT NULL CHECK(creado_por IN ('ACCOUNTANT', 'CLIENT')),
        creado_en TEXT NOT NULL DEFAULT (datetime('now')),
        revisado_por TEXT DEFAULT NULL,
        revisado_en TEXT DEFAULT NULL,
        referencia_archivo TEXT DEFAULT NULL,
        con_soporte INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO categorias (nombre) VALUES ('Transporte');
      INSERT INTO gastos (fecha, importe_cents, tasa_btw, concepto, categoria_id, estado, creado_por, con_soporte)
        VALUES ('2025-01-05', 900, 0, 'Taxi', 1, 'APROBADO', 'CLIENT', 1);
    `);
    old.close();

    const store = new ExpenseMolecule(path);
    await store.initialize();
    const [expense] = store.listExpenses();

    expect(expense.estado).toBe("APROBADO");
    expect(expense.con_soporte).toBe(true);
    expect(expense.importe_cents).toBe(900);
    // La tabla nueva acepta la anulación.
    expect(store.annulExpense(expense.id, "contador", "Prueba de migración").estado).toBe("ANULADO");
    await store.dispose();
  });

  it("una base ya migrada no se reconstruye de nuevo", async () => {
    const path = join(dir, "nueva.db");
    const first = new ExpenseMolecule(path);
    await first.initialize();
    const categoryId = first.listCategories()[0].id;
    first.createExpense(
      { fecha: "2025-03-10", importe_cents: 500, tasa_btw: 0, concepto: "Sello", categoria_id: categoryId },
      "CLIENT",
    );
    await first.dispose();

    const second = new ExpenseMolecule(path);
    await second.initialize();
    expect(second.listExpenses()).toHaveLength(1);
    await second.dispose();
  });
});
