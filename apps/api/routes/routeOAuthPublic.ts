import type { IncomingMessage, ServerResponse } from "node:http";
import { OAuthError } from "../../../domains/mcp/domain/OAuth";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import type { McpServer } from "../mcp/composeMcpServer";
import { AUTHORIZATION_SERVER_PATH, authorizationServerMetadata, OAUTH_REGISTER_PATH, OAUTH_TOKEN_PATH, PROTECTED_RESOURCE_PATH, protectedResourceMetadata } from "../mcp/oauthMetadata";
import { clientIp, enforceRateLimit } from "../middleware/limitRequests";
import { parseFormOrJsonBody } from "../http/parseFormOrJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// OAuth del servidor MCP, la parte SIN sesión (la usa el agente, no el
// usuario). La autorización en sí es una página de la web con sesión
// (`routeOAuthConsentRequest`).
//
//   GET  /.well-known/oauth-protected-resource[/…]     metadatos del recurso (RFC 9728)
//   GET  /.well-known/oauth-authorization-server[/…]   metadatos del servidor (RFC 8414)
//   POST /oauth/register                               registro dinámico (RFC 7591)
//   POST /oauth/token                                  código + PKCE, o renovación
//
// Errores con el formato de OAuth (`error`, `error_description`) y sin caché.
// Límites por IP: el registro es raro (30 por hora); los tokens, 60 por minuto.
// ---------------------------------------------------------------------------

export const OAUTH_REGISTER_POLICY: RateLimitPolicy = { windowMs: 3_600_000, maxRequests: 30 };
export const OAUTH_TOKEN_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 60 };
const MAX_BODY_BYTES = 16 * 1024;

const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

function sendOAuth(response: ServerResponse, status: number, body: unknown): void {
  response.setHeader("Cache-Control", "no-store");
  sendJson(response, status, body);
}

function sendOAuthError(response: ServerResponse, error: OAuthError): void {
  sendOAuth(response, error.code === "invalid_client" ? 401 : 400, { error: error.code, error_description: error.message });
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await parseFormOrJsonBody(request, MAX_BODY_BYTES).catch(() => {
    throw new OAuthError("invalid_request", "El cuerpo no es un formulario ni JSON válido.");
  });
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export async function routeOAuthPublic(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  server: McpServer | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  const path = url.pathname;
  const discovery = matches(path, PROTECTED_RESOURCE_PATH) || matches(path, AUTHORIZATION_SERVER_PATH);
  if (!discovery && path !== OAUTH_REGISTER_PATH && path !== OAUTH_TOKEN_PATH) return false;
  if (!server) {
    sendJson(response, 503, { message: "El servidor MCP no está disponible." });
    return true;
  }
  const method = request.method ?? "GET";

  if (discovery) {
    if (method !== "GET") return methodNotAllowed(response, "GET");
    response.setHeader("Cache-Control", "public, max-age=3600");
    sendJson(response, 200, matches(path, PROTECTED_RESOURCE_PATH) ? protectedResourceMetadata(server.addresses) : authorizationServerMetadata(server.addresses));
    return true;
  }
  if (method !== "POST") return methodNotAllowed(response, "POST");

  const register = path === OAUTH_REGISTER_PATH;
  await enforceRateLimit(rateLimiter, `oauth:${register ? "register" : "token"}:${clientIp(request)}`, register ? OAUTH_REGISTER_POLICY : OAUTH_TOKEN_POLICY);
  try {
    const body = await readBody(request);
    if (register) sendOAuth(response, 201, await server.oauth.register(body));
    else sendOAuth(response, 200, await server.oauth.exchange(body));
  } catch (error) {
    if (!(error instanceof OAuthError)) throw error;
    sendOAuthError(response, error);
  }
  return true;
}

function methodNotAllowed(response: ServerResponse, allow: string): true {
  response.setHeader("Allow", allow);
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
