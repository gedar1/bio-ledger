/**
 * Alcance del asistente del contador. Funciones puras.
 *
 * El contador tiene una sola sesión de chat y cada herramienta recibe el `tenantId` del cliente.
 * Estas funciones limitan ese `tenantId` a los clientes de la cuenta y dan al modelo la lista
 * de clientes para que traduzca un nombre o un ID a `tenantId`.
 */

/** Decide si una llamada a herramienta puede ejecutarse. Devuelve el motivo si no puede. */
export type ToolGuard = (name: string, args: unknown) => string | null;

export const CLIENT_NOT_ALLOWED = "Cliente no encontrado o no pertenece a esta cuenta.";

/**
 * Guarda que solo deja pasar un `tenantId` de la lista permitida. Las herramientas sin
 * `tenantId` no se tocan.
 */
export function tenantScopeGuard(allowedTenantIds: readonly string[]): ToolGuard {
  const allowed = new Set(allowedTenantIds);
  return (_name, args) => {
    if (typeof args !== "object" || args === null || !("tenantId" in args)) return null;
    const tenantId = (args as { tenantId: unknown }).tenantId;
    return typeof tenantId === "string" && allowed.has(tenantId) ? null : CLIENT_NOT_ALLOWED;
  };
}

/** Texto de contexto con los clientes de la cuenta, en el formato que lee el modelo. */
export function clientsContextText(
  clients: readonly { tenant_id: string; display_name: string }[],
): string {
  if (clients.length === 0) return "Clientes del contador: ninguno.";
  const lines = clients.map((c) => `- ${c.display_name} (tenantId: ${c.tenant_id})`);
  return ["Clientes del contador:", ...lines].join("\n");
}
