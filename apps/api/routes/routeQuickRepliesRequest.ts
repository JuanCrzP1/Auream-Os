import type { IncomingMessage, ServerResponse } from "node:http";
import type { SaveQuickReplyRequest } from "../../../contracts/QuickReplyContracts";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import type { QuickReplyServices } from "../../../domains/quick-replies/application/QuickReplyServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeQuickRepliesRequest — `/quick-replies`: respuestas rápidas del chat.
//
//   GET    /quick-replies           las de la cuenta (+ canWrite)   conversations.read
//   POST   /quick-replies           crear { shortcut, pieces }      conversations.write
//   PUT    /quick-replies/:id       editar { shortcut, pieces }     conversations.write
//   DELETE /quick-replies/:id       borrar                          conversations.write
//   POST   /quick-replies/:id/use   se usó en un chat (orden)       conversations.write
// ---------------------------------------------------------------------------

const ITEM = /^\/quick-replies\/([^/]+)$/;
const USE = /^\/quick-replies\/([^/]+)\/use$/;

export async function routeQuickRepliesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: QuickReplyServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/quick-replies" && !path.startsWith("/quick-replies/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Las respuestas rápidas no están disponibles en este servidor." });
    return true;
  }

  const { tenantId } = context;
  const method = request.method ?? "GET";
  requireScope(context, method === "GET" ? ConversationPermissions.read : ConversationPermissions.write, tenantId);
  const noContent = () => {
    response.statusCode = 204;
    response.end();
  };

  if (path === "/quick-replies" && method === "GET") {
    sendJson(response, 200, { quickReplies: await services.list(tenantId), canWrite: context.scopes.includes(ConversationPermissions.write) });
    return true;
  }
  if (path === "/quick-replies" && method === "POST") {
    const body = await parseJsonBody<Partial<SaveQuickReplyRequest>>(request);
    sendJson(response, 201, await services.create(tenantId, context.actorId, body));
    return true;
  }

  const use = USE.exec(path);
  if (use && method === "POST") {
    await services.markUsed(tenantId, use[1]!);
    noContent();
    return true;
  }

  const item = ITEM.exec(path);
  if (item && method === "PUT") {
    const body = await parseJsonBody<Partial<SaveQuickReplyRequest>>(request);
    sendJson(response, 200, await services.update(tenantId, item[1]!, body));
    return true;
  }
  if (item && method === "DELETE") {
    await services.remove(tenantId, item[1]!);
    noContent();
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
