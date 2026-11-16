import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { apiPost, ApiRequestError } from "../../api";

interface ClientRow {
  tenant_id: string;
  display_name: string;
  status: string;
  must_change_password: boolean;
}

interface ClientsData {
  clients: ClientRow[];
}

interface CreatedClient {
  tenant_id: string;
  temp_password: string;
}

export function ClientsPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [created, setCreated] = useState<CreatedClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiPost<ClientsData>("accountant/clients", {}, token);
      setClients(data.clients);
    } catch {
      setError(t("errors.generic"));
    }
  }, [token, t]);

  // Se carga al entrar. Después solo se actualiza con las acciones del usuario, sin sondeo.
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const data = await apiPost<CreatedClient>(
        "accountant/tenants",
        { tenant_id: tenantId.trim(), display_name: displayName.trim() },
        token,
      );
      setCreated(data);
      setTenantId("");
      setDisplayName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.info.status === 409 ? t("clients.duplicate") : t("errors.generic"));
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <h2 className="font-serif text-3xl">{t("clients.title")}</h2>

      <form onSubmit={create} className="grid gap-4 rounded-lg border border-hairline-soft p-6 md:grid-cols-[1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("clients.clientId")}
          <input
            required
            pattern="[a-z0-9-]+"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          {t("clients.displayName")}
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
          />
        </label>
        <button type="submit" className="h-11 self-end rounded-lg bg-primary px-5 text-sm font-medium text-on-primary">
          {t("clients.create")}
        </button>
      </form>

      {created && (
        <div className="rounded-lg border border-beige-deep bg-cream p-4">
          <p className="text-sm text-slate">{t("clients.tempPassword")}</p>
          <p className="mt-1 font-mono text-lg">
            {created.tenant_id}: {created.temp_password}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-primary-deep">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-hairline-soft">
        {clients === null ? null : clients.length === 0 ? (
          <p className="p-6 text-sm text-steel">{t("clients.empty")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-4 py-3 font-medium">{t("clients.clientId")}</th>
                <th className="px-4 py-3 font-medium">{t("clients.displayName")}</th>
                <th className="px-4 py-3 font-medium">{t("clients.active")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.tenant_id} className="border-t border-hairline-soft">
                  <td className="px-4 py-3 font-mono">{c.tenant_id}</td>
                  <td className="px-4 py-3">{c.display_name}</td>
                  <td className="px-4 py-3 text-steel">
                    {c.must_change_password ? t("clients.mustChange") : t("clients.active")}
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
