import type { IncomingMessage, ServerResponse } from "node:http";
import type { ScheduledMessageService } from "../../../domains/conversations/application/ScheduledMessageService";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeScheduledMessagesRequest — mensajes programados de un chat.
//
//   GET    /conversations/:id/scheduled               los abiertos        conversations.read
//   POST   /conversations/:id/scheduled               programar           conversations.write
//          { parts, date, time, cancelIfReplied }
//   PATCH  /conversations/:id/scheduled/:sid          editar (pendiente)  conversations.write
//   POST   /conversations/:id/scheduled/:sid/send     enviar ya           conversations.write
//   DELETE /conversations/:id/scheduled/:sid          cancelar/descartar  conversations.write
//
// Cada uno responde con los programados abiertos del chat y la zona horaria
// del negocio. Quien lo programa queda como autor: el mensaje sale a su nombre.
// ---------------------------------------------------------------------------

const LIST = /^\/conversations\/([^/]+)\/scheduled$/;
const ITEM = /^\/conversations\/([^/]+)\/scheduled\/([^/]+)$/;
const SEND = /^\/conversations\/([^/]+)\/scheduled\/([^/]+)\/send$/;

export async function routeScheduledMessagesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  service: ScheduledMessageService,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  const list = LIST.exec(path);
  const item = ITEM.exec(path);
  const send = SEND.exec(path);
  if (!list && !item && !send) return false;

  const { tenantId } = context;
  const method = request.method ?? "GET";
  requireScope(context, method === "GET" ? ConversationPermissions.read : ConversationPermissions.write, tenantId);

  if (list && method === "GET") {
    sendJson(response, 200, await service.list(tenantId, list[1]!));
    return true;
  }
  if (list && method === "POST") {
    sendJson(response, 201, await service.schedule(tenantId, list[1]!, await parseJsonBody<unknown>(request), context.actorId));
    return true;
  }
  if (item && method === "PATCH") {
    sendJson(response, 200, await service.update(tenantId, item[1]!, item[2]!, await parseJsonBody<unknown>(request)));
    return true;
  }
  if (item && method === "DELETE") {
    sendJson(response, 200, await service.cancel(tenantId, item[1]!, item[2]!));
    return true;
  }
  if (send && method === "POST") {
    sendJson(response, 200, await service.sendNow(tenantId, send[1]!, send[2]!));
    return true;
  }
  sendJson(response, 405, { message: "Método no permitido." });
  return true;
}
