/**
 * Cliente de la API de bio-ledger. Todas las peticiones pasan por aquí, así que el token
 * y el manejo de errores viven en un solo lugar.
 */

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  readonly info: ApiError;

  constructor(info: ApiError) {
    super(info.message);
    this.info = info;
  }
}

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/** POST a /api/<route>. La API responde siempre con POST para estas rutas. */
export async function apiPost<T>(
  route: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api/${route}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  // Algunas rutas (p. ej. chat) responden el cuerpo directo, sin sobre de éxito.
  if (response.ok && payload && typeof payload === "object" && !("success" in payload)) {
    return payload as unknown as T;
  }

  if (!response.ok || !payload || payload.success !== true) {
    const error =
      payload && payload.success === false ? payload.error : undefined;
    throw new ApiRequestError({
      status: response.status,
      code: error?.code ?? "HTTP_ERROR",
      message: error?.message ?? "",
    });
  }
  return payload.data;
}
