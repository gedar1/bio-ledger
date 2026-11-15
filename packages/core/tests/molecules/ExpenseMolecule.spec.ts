import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExpenseMolecule,
  ExpenseRuleError,
  DEFAULT_CATEGORY_NAMES,
  type ExpenseInput,
} from "../../src/molecules/ExpenseMolecule.js";
import {
  canClientModify,
  canDecide,
  validateRejectionNote,
} from "../../src/atoms/expenseRules.js";

describe("reglas de gastos (atoms)", () => {
  it("el cliente solo modifica gastos propios y pendientes", () => {
    expect(canClientModify("PENDIENTE", "CLIENT")).toBe(true);
    expect(canClientModify("PENDIENTE", "ACCOUNTANT")).toBe(false);
    expect(canClientModify("APROBADO", "CLIENT")).toBe(false);
    expect(canClientModify("RECHAZADO", "CLIENT")).toBe(false);
  });

  it("solo se decide un gasto pendiente", () => {
    expect(canDecide("PENDIENTE")).toBe(true);
    expect(canDecide("APROBADO")).toBe(false);
    expect(canDecide("RECHAZADO")).toBe(false);
  });

  it("el rechazo exige una nota de al menos 3 caracteres", () => {
    expect(validateRejectionNote(undefined)).not.toBeNull();
    expect(validateRejectionNote("  ok ")).not.toBeNull();
    expect(validateRejectionNote("falta factura")).toBeNull();
  });
});

describe("ExpenseMolecule", () => {
  let dir: string;
  let store: ExpenseMolecule;
  let categoryId: number;

  const input = (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
    fecha: "2025-03-10",
    importe_cents: 1250,
    tasa_btw: 21,
    concepto: "Papel A4",
    categoria_id: categoryId,
    ...overrides,
  });

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "expenses-"));
    store = new ExpenseMolecule(join(dir, "cliente.db"));
    await store.initialize();
    categoryId = store.listCategories()[0].id;
  });

  afterEach(async () => {
    await store.dispose();
    rmSync(dir, { recursive: true, force: true });
  });

  it("siembra las categorías por defecto sin deducibilidad confirmada", () => {
    const categories = store.listCategories();
    expect(categories.map((c) => c.nombre).sort()).toEqual([...DEFAULT_CATEGORY_NAMES].sort());
    expect(categories.every((c) => c.deducible === null)).toBe(true);
  });

  it("registra el gasto del cliente como pendiente y con su creador", () => {
    const expense = store.createExpense(input(), "CLIENT");

    expect(expense.estado).toBe("PENDIENTE");
    expect(expense.creado_por).toBe("CLIENT");
    expect(expense.importe_cents).toBe(1250);
  });

  it("rechaza importes con decimales o cero", () => {
    expect(() => store.createExpense(input({ importe_cents: 12.5 }), "CLIENT")).toThrow();
    expect(() => store.createExpense(input({ importe_cents: 0 }), "CLIENT")).toThrow();
  });

  it("rechaza una tasa de BTW fuera de 0, 9 y 21", () => {
    expect(() => store.createExpense(input({ tasa_btw: 10 as 9 }), "CLIENT")).toThrow();
  });

  it("el cliente edita su gasto mientras está pendiente", () => {
    const expense = store.createExpense(input(), "CLIENT");

    const edited = store.updateExpenseByClient(expense.id, input({ importe_cents: 1500 }));
    expect(edited.importe_cents).toBe(1500);
  });

  it("el cliente no edita un gasto ya decidido", () => {
    const expense = store.createExpense(input(), "CLIENT");
    store.decideExpense(expense.id, "APROBADO", "contador");

    expect(() => store.updateExpenseByClient(expense.id, input())).toThrow(ExpenseRuleError);
  });

  it("el cliente no edita un gasto que creó el contador", () => {
    const expense = store.createExpense(input(), "ACCOUNTANT");

    expect(() => store.updateExpenseByClient(expense.id, input())).toThrow(ExpenseRuleError);
  });

  it("el rechazo exige nota y la guarda", () => {
    const expense = store.createExpense(input(), "CLIENT");

    expect(() => store.decideExpense(expense.id, "RECHAZADO", "contador")).toThrow(ExpenseRuleError);

    const rejected = store.decideExpense(expense.id, "RECHAZADO", "contador", "Falta el recibo");
    expect(rejected.estado).toBe("RECHAZADO");
    expect(rejected.nota_rechazo).toBe("Falta el recibo");
    expect(rejected.revisado_por).toBe("contador");
  });

  it("una decisión es final", () => {
    const expense = store.createExpense(input(), "CLIENT");
    store.decideExpense(expense.id, "APROBADO", "contador");

    expect(() => store.decideExpense(expense.id, "RECHAZADO", "contador", "cambio de idea")).toThrow(
      ExpenseRuleError,
    );
    expect(store.getExpense(expense.id)?.estado).toBe("APROBADO");
  });

  it("devuelve NOT_FOUND para un gasto que no existe", () => {
    try {
      store.decideExpense(999, "APROBADO", "contador");
      expect.fail("debía lanzar");
    } catch (error) {
      expect((error as ExpenseRuleError).code).toBe("NOT_FOUND");
    }
  });
});

describe("aislamiento entre clientes", () => {
  let dir: string;
  let a: ExpenseMolecule;
  let b: ExpenseMolecule;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "expenses-iso-"));
    a = new ExpenseMolecule(join(dir, "cliente-a.db"));
    b = new ExpenseMolecule(join(dir, "cliente-b.db"));
    await a.initialize();
    await b.initialize();
  });

  afterEach(async () => {
    await a.dispose();
    await b.dispose();
    rmSync(dir, { recursive: true, force: true });
  });

  it("cada base solo ve sus propios gastos", () => {
    const catA = a.listCategories()[0].id;
    a.createExpense(
      { fecha: "2025-01-05", importe_cents: 900, tasa_btw: 0, concepto: "Taxi", categoria_id: catA },
      "CLIENT",
    );

    expect(a.listExpenses()).toHaveLength(1);
    expect(b.listExpenses()).toHaveLength(0);
  });

  it("no se puede decidir un gasto de otro cliente por su id", () => {
    const catA = a.listCategories()[0].id;
    const expenseA = a.createExpense(
      { fecha: "2025-01-05", importe_cents: 900, tasa_btw: 0, concepto: "Taxi", categoria_id: catA },
      "CLIENT",
    );

    expect(() => b.decideExpense(expenseA.id, "APROBADO", "contador")).toThrow(ExpenseRuleError);
    expect(a.getExpense(expenseA.id)?.estado).toBe("PENDIENTE");
  });
});
