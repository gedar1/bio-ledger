/**
 * Perfiles de dominio del producto contable. Cada rol conversa con su propio agente,
 * sus herramientas y su historial, aunque ambos pertenezcan al mismo tenant.
 */
export const LEDGER_CLIENT_PROFILE = "ledger-cliente";
export const LEDGER_ACCOUNTANT_PROFILE = "ledger-contador";

/** Clave de la sesión de un tenant y perfil. Sin perfil, es la sesión por defecto del tenant. */
export function sessionKey(tenantId: string, profile?: string): string {
  return profile ? `${tenantId}::${profile}` : tenantId;
}
