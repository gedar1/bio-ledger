import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiPost, ApiRequestError } from "../api";

export interface StatementData {
  periodo: string;
  desde: string;
  hasta: string;
  saldo_inicial_cents: number;
  aprobados: {
    cantidad: number;
    total_cents: number;
    por_categoria: Array<{ categoria_id: number; nombre: string; total_cents: number }>;
    por_tasa_btw: Array<{ tasa: number; base_cents: number; btw_cents: number; total_cents: number }>;
    deducible_cents: number;
    sin_soporte_cents: number;
  };
  anulados: { cantidad: number; total_cents: number };
  pendientes: { cantidad: number; total_cents: number };
}

/** Periodo en formato del servidor: AAAA-MM o AAAA-Tn. */
type PeriodKind = "month" | "quarter";

const eur = (cents: number) => (cents / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

export function periodFrom(kind: PeriodKind, value: string, quarter: number, year: number): string {
  return kind === "month" ? value : `${year}-T${quarter}`;
}

export function StatementPage({
  role,
  token,
  tenantId,
}: {
  role: "accountant" | "client";
  token: string;
  tenantId?: string;
}) {
  const { t } = useTranslation();
  const now = new Date();
  const [kind, setKind] = useState<PeriodKind>("month");
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const periodo = periodFrom(kind, month, quarter, year);
    try {
      const data =
        role === "accountant"
          ? await apiPost<{ statement: StatementData }>(
              "ledger/accountant/statement",
              { tenant_id: tenantId, periodo },
              token,
            )
          : await apiPost<{ statement: StatementData }>("ledger/statement", { periodo }, token);
      setStatement(data.statement);
    } catch (err) {
      setStatement(null);
      setError(err instanceof ApiRequestError && err.info.status === 422 ? t("statement.invalidPeriod") : t("errors.generic"));
    }
  }, [kind, month, quarter, year, role, tenantId, token, t]);

  // Se carga al entrar y al cambiar el periodo. No hay sondeo: los datos cambian solo por acciones.
  useEffect(() => {
    void load();
  }, [load]);

  const field = "h-10 rounded-lg border border-hairline-strong bg-canvas px-3 text-sm text-ink";
  const panel = "rounded-lg border border-hairline-soft p-6";

  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-serif text-3xl">{t("statement.title")}</h2>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("statement.kind")}
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as PeriodKind)}>
            <option value="month">{t("statement.month")}</option>
            <option value="quarter">{t("statement.quarter")}</option>
          </select>
        </label>
        {kind === "month" ? (
          <label className="flex flex-col gap-1 text-sm text-slate">
            {t("statement.period")}
            <input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm text-slate">
              {t("statement.quarterLabel")}
              <select className={field} value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    T{q}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate">
              {t("statement.year")}
              <input
                type="number"
                min={2000}
                max={2100}
                className={field}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          </>
        )}
      </div>

      {error && <p className="text-sm text-primary-deep">{error}</p>}

      {statement && (
        <>
          <p className="text-sm text-steel">
            {t("statement.range", { desde: statement.desde, hasta: statement.hasta })} · {t("statement.onlyApproved")}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={panel}>
              <p className="text-xs text-steel">{t("statement.approvedTotal")}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{eur(statement.aprobados.total_cents)}</p>
              <p className="mt-1 text-xs text-steel">
                {statement.aprobados.cantidad} {t("statement.expensesCount")}
              </p>
            </div>
            <div className={panel}>
              <p className="text-xs text-steel">{t("statement.pendingTotal")}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{eur(statement.pendientes.total_cents)}</p>
              <p className="mt-1 text-xs text-steel">
                {statement.pendientes.cantidad} {t("statement.expensesCount")}
              </p>
            </div>
            <div className={panel}>
              <p className="text-xs text-steel">{t("statement.voidedTotal")}</p>
              <p className="mt-2 font-serif text-3xl tabular-nums">{eur(statement.anulados.total_cents)}</p>
              <p className="mt-1 text-xs text-steel">
                {statement.anulados.cantidad} {t("statement.expensesCount")}
              </p>
            </div>
          </div>

          {role === "accountant" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className={panel}>
                <p className="text-xs text-steel">{t("statement.deductible")}</p>
                <p className="mt-2 font-serif text-2xl tabular-nums">{eur(statement.aprobados.deducible_cents)}</p>
              </div>
              <div className={panel}>
                <p className="text-xs text-steel">{t("statement.noSupport")}</p>
                <p className="mt-2 font-serif text-2xl tabular-nums">{eur(statement.aprobados.sin_soporte_cents)}</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className={panel}>
              <h3 className="text-sm font-medium">{t("statement.byCategory")}</h3>
              <ul className="mt-3 divide-y divide-hairline-soft text-sm">
                {statement.aprobados.por_categoria.length === 0 && <li className="py-2 text-steel">—</li>}
                {statement.aprobados.por_categoria.map((c) => (
                  <li key={c.categoria_id} className="flex justify-between py-2">
                    <span>{c.nombre}</span>
                    <span className="tabular-nums">{eur(c.total_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={panel}>
              <h3 className="text-sm font-medium">{t("statement.byRate")}</h3>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-steel">
                  <tr>
                    <th className="py-2 font-medium">{t("statement.rate")}</th>
                    <th className="py-2 text-right font-medium">{t("statement.base")}</th>
                    <th className="py-2 text-right font-medium">{t("statement.vat")}</th>
                    <th className="py-2 text-right font-medium">{t("statement.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.aprobados.por_tasa_btw.length === 0 && (
                    <tr>
                      <td className="py-2 text-steel" colSpan={4}>
                        —
                      </td>
                    </tr>
                  )}
                  {statement.aprobados.por_tasa_btw.map((r) => (
                    <tr key={r.tasa} className="border-t border-hairline-soft">
                      <td className="py-2">{r.tasa}%</td>
                      <td className="py-2 text-right tabular-nums">{eur(r.base_cents)}</td>
                      <td className="py-2 text-right tabular-nums">{eur(r.btw_cents)}</td>
                      <td className="py-2 text-right tabular-nums">{eur(r.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
