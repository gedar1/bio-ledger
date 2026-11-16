import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiPost, ApiRequestError } from "../../api";
import { parseEuroToCents } from "../client/ExpensesPage";

interface Category {
  id: number;
  nombre: string;
}

interface Expense {
  id: number;
  fecha: string;
  importe_cents: number;
  tasa_btw: 0 | 9 | 21;
  concepto: string;
  categoria_id: number;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "ANULADO";
  creado_por: "CLIENT" | "ACCOUNTANT";
  con_soporte: boolean;
  nota_rechazo: string | null;
  nota_anulacion: string | null;
}

interface ExpenseForm {
  fecha: string;
  amount: string;
  tasa_btw: 0 | 9 | 21;
  concepto: string;
  categoria_id: number | "";
  con_soporte: boolean;
}

const VAT_RATES = [0, 9, 21] as const;

const emptyForm = (): ExpenseForm => ({
  fecha: new Date().toISOString().slice(0, 10),
  amount: "",
  tasa_btw: 21,
  concepto: "",
  categoria_id: "",
  con_soporte: false,
});

function ExpenseFields({
  form,
  setForm,
  categories,
}: {
  form: ExpenseForm;
  setForm: (next: ExpenseForm) => void;
  categories: Category[];
}) {
  const { t } = useTranslation();
  const field = "h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none";
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-slate">
        {t("expenses.date")}
        <input type="date" required value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate">
        {t("expenses.amount")}
        <input
          required
          inputMode="decimal"
          placeholder="0,00"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate">
        {t("expenses.vat")}
        <select
          value={form.tasa_btw}
          onChange={(e) => setForm({ ...form, tasa_btw: Number(e.target.value) as ExpenseForm["tasa_btw"] })}
          className="h-11 rounded-lg border border-hairline-strong bg-canvas px-3 text-ink"
        >
          {VAT_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}%
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate">
        {t("expenses.category")}
        <select
          required
          value={form.categoria_id}
          onChange={(e) => setForm({ ...form, categoria_id: e.target.value === "" ? "" : Number(e.target.value) })}
          className="h-11 rounded-lg border border-hairline-strong bg-canvas px-3 text-ink"
        >
          <option value="" />
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate md:col-span-2">
        {t("expenses.concept")}
        <input required value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate">
        <input type="checkbox" checked={form.con_soporte} onChange={(e) => setForm({ ...form, con_soporte: e.target.checked })} />
        {t("expenses.support")}
      </label>
    </>
  );
}

export function ReviewPage({ token, tenantId }: { token: string; tenantId: string }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [createForm, setCreateForm] = useState<ExpenseForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ExpenseForm>(emptyForm);
  /** Acción que pide una nota: rechazar o anular, con el id del gasto. */
  const [noteFor, setNoteFor] = useState<{ id: number; action: "RECHAZADO" | "ANULADO" } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cats, list] = await Promise.all([
        apiPost<{ categories: Category[] }>("ledger/accountant/categories/list", { tenant_id: tenantId }, token),
        apiPost<{ expenses: Expense[] }>("ledger/accountant/expenses/list", { tenant_id: tenantId }, token),
      ]);
      setCategories(cats.categories);
      setExpenses(list.expenses);
    } catch {
      setError(t("errors.generic"));
    }
  }, [token, tenantId, t]);

  // Se carga al entrar y después solo tras cada acción del contador.
  useEffect(() => {
    void load();
  }, [load]);

  function messageFor(err: unknown): string {
    if (err instanceof ApiRequestError) {
      if (err.info.status === 409) return t("review.alreadyDecided");
      if (err.info.status === 422) return err.info.message || t("errors.generic");
    }
    return t("errors.generic");
  }

  /** Cuerpo común de alta y corrección. null si el importe no es válido. */
  function bodyFrom(form: ExpenseForm): Record<string, unknown> | null {
    const cents = parseEuroToCents(form.amount);
    if (cents === null || form.categoria_id === "") {
      setError(t("expenses.invalidAmount"));
      return null;
    }
    return {
      tenant_id: tenantId,
      fecha: form.fecha,
      importe_cents: cents,
      tasa_btw: form.tasa_btw,
      concepto: form.concepto.trim(),
      categoria_id: form.categoria_id,
      con_soporte: form.con_soporte,
    };
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const body = bodyFrom(createForm);
    if (!body) return;
    try {
      await apiPost("ledger/accountant/expenses/create", body, token);
      setCreateForm(emptyForm());
      await load();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setEditForm({
      fecha: expense.fecha,
      amount: (expense.importe_cents / 100).toFixed(2).replace(".", ","),
      tasa_btw: expense.tasa_btw,
      concepto: expense.concepto,
      categoria_id: expense.categoria_id,
      con_soporte: expense.con_soporte,
    });
  }

  async function saveEdit(event: FormEvent, id: number) {
    event.preventDefault();
    setError(null);
    const body = bodyFrom(editForm);
    if (!body) return;
    try {
      await apiPost("ledger/accountant/expenses/update", { ...body, id }, token);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function decide(id: number, decision: "APROBADO" | "RECHAZADO", decisionNote?: string) {
    setError(null);
    try {
      await apiPost("ledger/accountant/expenses/decide", { tenant_id: tenantId, id, decision, note: decisionNote }, token);
      setNoteFor(null);
      setNote("");
      await load();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function annul(id: number, annulNote: string) {
    setError(null);
    try {
      await apiPost("ledger/accountant/expenses/annul", { tenant_id: tenantId, id, note: annulNote }, token);
      setNoteFor(null);
      setNote("");
      await load();
    } catch (err) {
      setError(messageFor(err));
    }
  }

  const button = "rounded-lg px-3 py-1.5 text-xs font-medium";
  const ghost = `${button} border border-hairline-strong text-slate hover:text-ink`;
  const primary = `${button} bg-primary text-on-primary`;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-3xl">
          {t("review.title")}: <span className="font-mono text-2xl">{tenantId}</span>
        </h2>
        <Link to="/contador/clientes" className="text-sm text-steel hover:text-ink">
          {t("review.back")}
        </Link>
      </div>

      <form onSubmit={create} className="grid gap-4 rounded-lg border border-hairline-soft p-6 md:grid-cols-2">
        <h3 className="text-sm font-medium md:col-span-2">{t("review.newForClient")}</h3>
        <ExpenseFields form={createForm} setForm={setCreateForm} categories={categories} />
        <div className="flex items-center justify-end md:col-span-2">
          <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary">
            {t("expenses.save")}
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-primary-deep">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-hairline-soft">
        {expenses === null ? null : expenses.length === 0 ? (
          <p className="p-6 text-sm text-steel">{t("expenses.empty")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-4 py-3 font-medium">{t("expenses.date")}</th>
                <th className="px-4 py-3 font-medium">{t("expenses.concept")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("expenses.amount")}</th>
                <th className="px-4 py-3 font-medium">{t("expenses.state")}</th>
                <th className="px-4 py-3 font-medium">{t("review.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-hairline-soft align-top">
                  <td className="px-4 py-3">{e.fecha}</td>
                  <td className="px-4 py-3">
                    {e.concepto}
                    <span className="block text-xs text-steel">
                      {e.creado_por === "CLIENT" ? t("review.byClient") : t("review.byAccountant")} · {e.tasa_btw}%
                      {!e.con_soporte && ` · ${t("review.noSupport")}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(e.importe_cents / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" })}
                  </td>
                  <td className="px-4 py-3 text-steel">
                    {t(`expenses.status.${e.estado}`)}
                    {e.nota_rechazo && <span className="block text-xs">{e.nota_rechazo}</span>}
                    {e.nota_anulacion && <span className="block text-xs">{e.nota_anulacion}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {e.estado === "PENDIENTE" && (
                      <div className="flex flex-wrap gap-2">
                        <button className={primary} onClick={() => void decide(e.id, "APROBADO")}>
                          {t("review.approve")}
                        </button>
                        <button className={ghost} onClick={() => setNoteFor({ id: e.id, action: "RECHAZADO" })}>
                          {t("review.reject")}
                        </button>
                        <button className={ghost} onClick={() => startEdit(e)}>
                          {t("review.edit")}
                        </button>
                      </div>
                    )}
                    {e.estado === "APROBADO" && (
                      <button className={ghost} onClick={() => setNoteFor({ id: e.id, action: "ANULADO" })}>
                        {t("review.annul")}
                      </button>
                    )}
                    {noteFor?.id === e.id && (
                      <form
                        className="mt-3 flex flex-col gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (noteFor.action === "RECHAZADO") void decide(e.id, "RECHAZADO", note);
                          else void annul(e.id, note);
                        }}
                      >
                        <input
                          required
                          minLength={3}
                          value={note}
                          onChange={(ev) => setNote(ev.target.value)}
                          placeholder={t("review.noteRequired")}
                          className="h-9 rounded-lg border border-hairline-strong px-2 text-sm"
                        />
                        <button type="submit" className={primary}>
                          {noteFor.action === "RECHAZADO" ? t("review.reject") : t("review.annul")}
                        </button>
                      </form>
                    )}
                    {editingId === e.id && (
                      <form
                        className="mt-3 grid gap-3 rounded-lg border border-hairline-soft p-4"
                        onSubmit={(event) => void saveEdit(event, e.id)}
                      >
                        <ExpenseFields form={editForm} setForm={setEditForm} categories={categories} />
                        <div className="flex gap-2">
                          <button type="submit" className={primary}>
                            {t("expenses.save")}
                          </button>
                          <button type="button" className={ghost} onClick={() => setEditingId(null)}>
                            {t("review.cancel")}
                          </button>
                        </div>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
