import type { IncomingMessage } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import type { AuthService } from "../../../platform/identity/application/AuthService";

// ---------------------------------------------------------------------------
// authenticateRequest
//
// Extrae y verifica credenciales de la request HTTP.
// Soporta dos métodos de autenticación:
//   - Bearer <token>  → JWT HS256
//   - X-Api-Key: bfk_ → API key
//
// Devuelve RequestContext (identidad resuelta) o null (no autenticado).
// La función nunca lanza — los errores de verificación se convierten en null.
//
// Regla de seguridad: el tenant NUNCA viene de query string o body.
// El tenantId se extrae siempre de la identidad autenticada (JWT claims o API key).
// ---------------------------------------------------------------------------

export async function authenticateRequest(
  request: IncomingMessage,
  authService: AuthService
): Promise<RequestContext | null> {
  const authHeader = request.headers["authorization"];

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    try {
      return await authService.authenticateBearer(authHeader.slice(7));
    } catch {
      return null;
    }
  }

  const apiKeyHeader = request.headers["x-api-key"];

  if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) {
    try {
      return await authService.authenticateApiKey(apiKeyHeader);
    } catch {
      return null;
    }
  }

  return null;
}
