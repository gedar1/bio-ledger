import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiPost } from "../../api";
import { parseEuroToCents, VAT_RATES } from "@/shared";
import type { Category, Expense } from "@/types";

export function ExpensesPage({ token }: Readonly<{ token: string }>) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState<(typeof VAT_RATES)[number]>(21);
  const [concept, setConcept] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [support, setSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cats, list] = await Promise.all([
        apiPost<{ categories: Category[] }>(
          "ledger/categories/list",
          {},
          token,
        ),
        apiPost<{ expenses: Expense[] }>("ledger/expenses/list", {}, token),
      ]);
      setCategories(cats.categories);
      setExpenses(list.expenses);
    } catch {
      setError(t("errors.generic"));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    const cents = parseEuroToCents(amount);
    if (cents === null) {
      setError(t("expenses.invalidAmount"));
      return;
    }
    try {
      await apiPost(
        "ledger/expenses/create",
        {
          fecha: date,
          importe_cents: cents,
          tasa_btw: vat,
          concepto: concept.trim(),
          categoria_id: categoryId,
          con_soporte: support,
        },
        token,
      );
      setAmount("");
      setConcept("");
      setSupport(false);
      await load();
    } catch {
      setError(t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-serif text-3xl">{t("expenses.title")}</h2>

      <form
        onSubmit={create}
        className="grid gap-4 rounded-lg border border-hairline-soft p-6 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("expenses.date")}
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("expenses.amount")}
          <input
            required
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("expenses.vat")}
          <select
            value={vat}
            onChange={(e) =>
              setVat(Number(e.target.value) as (typeof VAT_RATES)[number])
            }
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
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value === "" ? "" : Number(e.target.value))
            }
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
          <input
            required
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate">
          <input
            type="checkbox"
            checked={support}
            onChange={(e) => setSupport(e.target.checked)}
          />
          {t("expenses.support")}
        </label>
        <div className="flex items-center justify-end">
          <button
            type="submit"
            className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-on-primary"
          >
            {t("expenses.save")}
          </button>
        </div>
        {error && (
          <p className="text-sm text-primary-deep md:col-span-2">{error}</p>
        )}
      </form>

      <div className="overflow-hidden rounded-lg border border-hairline-soft">
        {expenses === null ? null : expenses.length === 0 ? (
          <p className="p-6 text-sm text-steel">{t("expenses.empty")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-4 py-3 font-medium">{t("expenses.date")}</th>
                <th className="px-4 py-3 font-medium">
                  {t("expenses.concept")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("expenses.amount")}
                </th>
                <th className="px-4 py-3 font-medium">{t("expenses.state")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-hairline-soft">
                  <td className="px-4 py-3">{e.fecha}</td>
                  <td className="px-4 py-3">{e.concepto}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(e.importe_cents / 100).toLocaleString("nl-NL", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </td>
                  <td className="px-4 py-3 text-steel">
                    {t(`expenses.status.${e.estado}`)}
                    {e.nota_rechazo && (
                      <span className="block text-xs">{e.nota_rechazo}</span>
                    )}
                    {e.nota_anulacion && (
                      <span className="block text-xs">{e.nota_anulacion}</span>
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
