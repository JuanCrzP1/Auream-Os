import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CredentialPermissions } from "../../../platform/authorization/permissions/CredentialPermissions";
import type { CreateMcpCredentialRequest } from "../../../contracts/McpContracts";
import type { McpServer } from "../mcp/composeMcpServer";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `/mcp-credentials` — las credenciales de los agentes de IA de la cuenta.
// Dan acceso a los datos de la cuenta: como las demás integraciones, exigen
// `credentials.write` (dueños y administradores).
//
//   GET    /mcp-credentials        la dirección del servidor y las credenciales (sin token)
//   POST   /mcp-credentials        crear: devuelve el token UNA vez
//   DELETE /mcp-credentials/:id    revocar (deja de funcionar al instante)
// ---------------------------------------------------------------------------

const ITEM = /^\/mcp-credentials\/([^/]+)$/;

export async function routeMcpCredentialsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  server: McpServer | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/mcp-credentials" && !path.startsWith("/mcp-credentials/")) return false;
  requireScope(context, CredentialPermissions.write, context.tenantId);
  if (!server) {
    sendJson(response, 503, { message: "El servidor MCP no está disponible." });
    return true;
  }
  const method = request.method ?? "GET";
  if (path === "/mcp-credentials" && method === "GET") {
    sendJson(response, 200, { server: { url: server.url }, credentials: await server.credentials.list(context.tenantId) });
    return true;
  }
  if (path === "/mcp-credentials" && method === "POST") {
    sendJson(response, 201, await server.credentials.create(context.tenantId, await parseJsonBody<CreateMcpCredentialRequest>(request)));
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "DELETE") {
    await server.credentials.revoke(context.tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
