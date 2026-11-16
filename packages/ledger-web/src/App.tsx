import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ClientsPage } from "./pages/accountant/ClientsPage";
import { ReviewPage } from "./pages/accountant/ReviewPage";
import { ExpensesPage } from "./pages/client/ExpensesPage";
import { LoginPage } from "./pages/LoginPage";
import { clearSession, loadSession, type Session } from "./session";

const LANGUAGES = ["nl", "es", "en"] as const;

function Shell({ session, children }: { session: Session; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [, force] = useState(0);

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function changeLanguage(lang: (typeof LANGUAGES)[number]) {
    localStorage.setItem("ledger.lang", lang);
    void i18n.changeLanguage(lang);
    force((n) => n + 1);
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    `text-sm ${isActive ? "text-primary font-medium" : "text-slate hover:text-ink"}`;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline-soft">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <span className="font-serif text-xl">{t("app.name")}</span>
            <nav className="flex gap-6">
              {session.role === "accountant" ? (
                <NavLink to="/contador/clientes" className={link}>
                  {t("nav.clients")}
                </NavLink>
              ) : (
                <NavLink to="/cliente/gastos" className={link}>
                  {t("nav.expenses")}
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <select
              aria-label="language"
              value={i18n.language}
              onChange={(e) => changeLanguage(e.target.value as (typeof LANGUAGES)[number])}
              className="h-9 rounded-lg border border-hairline-strong bg-canvas px-2 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {t(`lang.${lang}`)}
                </option>
              ))}
            </select>
            <button type="button" onClick={logout} className="text-sm text-steel hover:text-ink">
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

/** Solo entra un token de contador; un cliente se envía a su pantalla. */
function AccountantRoute({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "accountant") return <Navigate to="/cliente/gastos" replace />;
  return (
    <Shell session={session}>
      <ClientsPage token={session.token} />
    </Shell>
  );
}

/** Revisión de un cliente de la cuenta del contador. */
function AccountantReviewRoute({ session }: { session: Session | null }) {
  const { tenantId = "" } = useParams();
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "accountant") return <Navigate to="/cliente/gastos" replace />;
  return (
    <Shell session={session}>
      <ReviewPage token={session.token} tenantId={tenantId} />
    </Shell>
  );
}

/** Solo entra un token de cliente; sin cambio de contraseña pendiente. */
function ClientRoute({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "client") return <Navigate to="/contador/clientes" replace />;
  return (
    <Shell session={session}>
      <ExpensesPage token={session.token} />
    </Shell>
  );
}

export default function App() {
  const session = loadSession();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/contador/clientes" element={<AccountantRoute session={session} />} />
      <Route path="/contador/clientes/:tenantId" element={<AccountantReviewRoute session={session} />} />
      <Route path="/cliente/gastos" element={<ClientRoute session={session} />} />
      <Route path="*" element={<Navigate to={session ? (session.role === "accountant" ? "/contador/clientes" : "/cliente/gastos") : "/login"} replace />} />
    </Routes>
  );
}
