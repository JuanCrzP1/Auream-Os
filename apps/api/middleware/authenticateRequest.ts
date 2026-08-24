import type { IncomingMessage } from "node:http";
import type { AuthenticatedPrincipal } from "../../../platform/identity/contracts/AuthenticatedPrincipal";
import type { AuthService } from "../../../platform/identity/application/AuthService";

// ---------------------------------------------------------------------------
// authenticateRequest
//
// Responsabilidad única: responder "¿quién eres?".
//
// Soporta dos credenciales:
//   Authorization: Bearer <jwt>  → usuario (Neon Auth)
//   X-Api-Key: bfk_...           → máquina (worker, integración)
//
// Devuelve null si no hay credencial válida. Nunca lanza: un fallo de
// verificación es "no autenticado", no un error del servidor.
//
// NO resuelve tenant ni permisos — eso es `resolveRequestContext`.
// ---------------------------------------------------------------------------

export async function authenticateRequest(
  request: IncomingMessage,
  authService: AuthService
): Promise<AuthenticatedPrincipal | null> {
  const authHeader = request.headers["authorization"];

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    try {
      const identity = await authService.authenticateBearer(authHeader.slice(7));
      return { kind: "user", identity };
    } catch {
      return null;
    }
  }

  const apiKeyHeader = request.headers["x-api-key"];

  if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
    try {
      const identity = await authService.authenticateApiKey(apiKeyHeader);
      return { kind: "machine", identity };
    } catch {
      return null;
    }
  }

  return null;
}
