import type { IncomingMessage, ServerResponse } from "node:http";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import { MCP_PATH, type McpServer } from "../mcp/composeMcpServer";
import { enforceRateLimit } from "../middleware/limitRequests";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `POST /mcp` — el servidor MCP (transporte HTTP «Streamable», sin estado ni
// flujo de eventos: cada petición JSON-RPC recibe su respuesta JSON). Lo usan
// los agentes con `Authorization: Bearer <token de su credencial>`; sin token
// válido, 401. Límite: 300 peticiones por minuto por credencial.
// ---------------------------------------------------------------------------

export const MCP_POLICY = { windowMs: 60_000, maxRequests: 300 };
const MAX_BODY_BYTES = 1024 * 1024;

function bearer(request: IncomingMessage): string {
  const header = request.headers.authorization ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function routeMcp(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  server: McpServer | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  if (url.pathname !== MCP_PATH) return false;
  if (!server) {
    sendJson(response, 503, { message: "El servidor MCP no está disponible." });
    return true;
  }
  if ((request.method ?? "GET") !== "POST") {
    // Sin flujo de eventos (GET) ni sesiones (DELETE): todo es una petición POST.
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { message: "El servidor MCP de Auream recibe peticiones POST." });
    return true;
  }
  const access = await server.credentials.authenticate(bearer(request));
  if (!access) {
    response.setHeader("WWW-Authenticate", 'Bearer realm="auream-mcp"');
    sendJson(response, 401, { message: "Falta una credencial válida: Authorization: Bearer <token>." });
    return true;
  }
  await enforceRateLimit(rateLimiter, `mcp:${access.credentialId}`, MCP_POLICY);

  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(request, MAX_BODY_BYTES);
  } catch {
    sendJson(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "El cuerpo no es JSON válido." } });
    return true;
  }
  const messages = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(messages.map((message) => server.protocol.handle(message, access)))).filter((reply) => reply !== null);
  if (replies.length === 0) {
    response.statusCode = 202;
    response.end();
    return true;
  }
  sendJson(response, 200, Array.isArray(body) ? replies : replies[0]);
  return true;
}
