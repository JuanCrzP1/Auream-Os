import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CredentialPermissions } from "../../../platform/authorization/permissions/CredentialPermissions";
import type { OAuthAuthorizeDecisionRequest, OAuthAuthorizeParams } from "../../../contracts/McpOAuthContracts";
import type { McpServer } from "../mcp/composeMcpServer";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// La pantalla de autorización OAuth (`/oauth/authorize` en la web), con la
// sesión del usuario y en la cuenta activa. Autorizar crea una credencial de
// agente con acceso a los datos de la cuenta: exige `credentials.write`
// (dueños y administradores), igual que crear una a mano.
//
//   GET  /oauth/authorize/request?<parámetros del agente>   qué agente pide acceso
//   POST /oauth/authorize/decision                          autorizar o rechazar
// ---------------------------------------------------------------------------

const MAX_PARAM_LENGTH = 2048;

/** Solo textos y de largo razonable: los parámetros vienen del navegador, tal cual los puso el agente. */
function toParams(raw: unknown): OAuthAuthorizeParams {
  const params: Record<string, string> = {};
  if (typeof raw !== "object" || raw === null) return params;
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string" && value.length <= MAX_PARAM_LENGTH) params[key] = value;
  return params;
}

export async function routeOAuthConsentRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  server: McpServer | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/oauth/authorize/request" && path !== "/oauth/authorize/decision") return false;
  requireScope(context, CredentialPermissions.write, context.tenantId);
  if (!server) {
    sendJson(response, 503, { message: "El servidor MCP no está disponible." });
    return true;
  }
  response.setHeader("Cache-Control", "no-store");
  const method = request.method ?? "GET";

  if (path === "/oauth/authorize/request" && method === "GET") {
    sendJson(response, 200, await server.oauth.describe(toParams(Object.fromEntries(url.searchParams))));
    return true;
  }
  if (path === "/oauth/authorize/decision" && method === "POST") {
    const body = await parseJsonBody<Partial<OAuthAuthorizeDecisionRequest>>(request);
    const decision: OAuthAuthorizeDecisionRequest = {
      params: toParams(body.params),
      approve: body.approve === true,
      ...(body.permissions ? { permissions: body.permissions } : {})
    };
    sendJson(response, 200, await server.oauth.decide(context.tenantId, decision));
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
