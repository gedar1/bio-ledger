/**
 * Comprobación de arranque. En modo `studio` la API no puede quedar abierta:
 * sin API_SECRET cualquiera que llegue al puerto actúa como operador.
 *
 * Para desarrollo local existe una salida explícita, ALLOW_OPEN_API=true. Hay que escribirla a propósito.
 */
export interface StartupInput {
  deploymentMode: "single" | "studio";
  authEnabled: boolean;
  allowOpenApi: boolean;
}

/** Mensaje de error si el servidor no debe arrancar; null si puede arrancar. */
export function openApiProblem(input: StartupInput): string | null {
  if (input.authEnabled || input.allowOpenApi) return null;
  if (input.deploymentMode !== "studio") return null;
  return "DEPLOYMENT_MODE=studio requiere API_SECRET. Define API_SECRET en .env. Para desarrollo local sin autenticación, define ALLOW_OPEN_API=true.";
}
