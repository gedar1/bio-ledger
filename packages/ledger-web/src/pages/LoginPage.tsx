import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiPost, ApiRequestError } from "../api";
import { saveSession, type Session, type Tab } from "@/shared";
import type {
  AccountantLoginData,
  ChangePasswordData,
  ClientLoginData,
} from "@/types";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("accountant");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Token del cliente con contraseña temporal, mientras cambia la contraseña. */
  const [pendingClient, setPendingClient] = useState<ClientLoginData | null>(
    null,
  );

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "accountant") {
        const data = await apiPost<AccountantLoginData>(
          "accountant/auth/login",
          {
            username: identifier.trim(),
            password,
          },
        );
        const session: Session = {
          role: "accountant",
          token: data.token,
          username: data.username,
        };
        saveSession(session);
        navigate("/contador/clientes", { replace: true });
        return;
      }
      const data = await apiPost<ClientLoginData>(
        "tenant/auth/password-login",
        {
          tenant_id: identifier.trim(),
          password,
        },
      );
      if (data.must_change_password) {
        setPendingClient(data);
        return;
      }
      saveSession({
        role: "client",
        token: data.token,
        tenantId: data.tenant_id,
        mustChangePassword: false,
      });
      navigate("/cliente/gastos", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.info.status === 401
          ? t("login.invalid")
          : t("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword(event: FormEvent) {
    event.preventDefault();
    if (!pendingClient) return;
    setError(null);
    setBusy(true);
    try {
      const data = await apiPost<ChangePasswordData>(
        "tenant/auth/change-password",
        { new_password: newPassword },
        pendingClient.token,
      );
      saveSession({
        role: "client",
        token: data.token,
        tenantId: pendingClient.tenant_id,
        mustChangePassword: false,
      });
      navigate("/cliente/gastos", { replace: true });
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg border px-4 py-2 text-sm font-medium ${
      active
        ? "border-ink bg-ink text-white"
        : "border-hairline-strong text-steel"
    }`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-8 font-serif text-4xl">{t("app.name")}</h1>

      {pendingClient ? (
        <form
          onSubmit={submitNewPassword}
          className="flex flex-col gap-4 rounded-lg border border-hairline-soft p-6"
        >
          <h2 className="text-lg font-medium">{t("login.changePassword")}</h2>
          <label className="flex flex-col gap-1 text-sm text-slate">
            {t("login.newPassword")}
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-primary-deep">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-primary text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {t("login.saveNew")}
          </button>
        </form>
      ) : (
        <form
          onSubmit={submitLogin}
          className="flex flex-col gap-4 rounded-lg border border-hairline-soft p-6"
        >
          <div className="flex gap-2">
            <button
              type="button"
              className={tabClass(tab === "accountant")}
              onClick={() => setTab("accountant")}
            >
              {t("login.accountantTab")}
            </button>
            <button
              type="button"
              className={tabClass(tab === "client")}
              onClick={() => setTab("client")}
            >
              {t("login.clientTab")}
            </button>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate">
            {tab === "accountant" ? t("login.username") : t("login.clientId")}
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate">
            {t("login.password")}
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 rounded-lg border border-hairline-strong px-3 text-ink focus:border-2 focus:border-primary focus:outline-none"
            />
          </label>
          {error && <p className="text-sm text-primary-deep">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-primary text-sm font-medium text-on-primary disabled:bg-hairline disabled:text-muted"
          >
            {t("login.submit")}
          </button>
        </form>
      )}
    </main>
  );
}
