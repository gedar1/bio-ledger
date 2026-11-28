/**
 * Contrato del almacén de ejecuciones de cadena pendientes de un dato del usuario
 * (por ejemplo, el cliente). Una implementación en memoria es la predeterminada;
 * una implementación en base de datos la reemplaza sin tocar UnifiedCortex.
 */

/** Estado de una consulta pendiente: lo que ya se sabe y lo que falta. */
export interface PendingState {
  /** Respuestas que no sirvieron para el dato que falta. */
  readonly attempts: number;
  /** Datos ya obtenidos, por nombre de requisito. */
  readonly values: Readonly<Record<string, string | undefined>>;
  /** Nombre del requisito que se está pidiendo. Null si aún no se ha preguntado ninguno. */
  readonly missing: string | null;
}

export interface PendingChainRequest extends PendingState {
  readonly chainId: string;
  readonly expiresAt: number;
}

export interface IPendingChainStore {
  /** Guarda una ejecución pendiente para la sesión. Los campos no indicados toman su valor inicial. */
  set(sessionId: string, chainId: string, state?: Partial<PendingState>): void;
  /** Devuelve la pendiente vigente de la sesión, o null si no existe o expiró. */
  get(sessionId: string): PendingChainRequest | null;
  /** Elimina la pendiente de la sesión. */
  clear(sessionId: string): void;
}
