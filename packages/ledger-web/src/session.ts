/**
 * Sesión en sessionStorage: se borra al cerrar la pestaña. El token se envía en el
 * encabezado Authorization; nunca se guarda en localStorage ni en cookies JavaScript.
 */

export type Session =
  | { role: "accountant"; token: string; username: string }
  | { role: "client"; token: string; tenantId: string; mustChangePassword: boolean };

const KEY = "ledger.session";

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}
