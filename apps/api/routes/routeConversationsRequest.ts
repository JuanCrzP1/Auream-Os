import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import type {
  ConversationFilter,
  ReactToMessageRequest,
  SetConversationLabelsRequest,
  StartFlowRequest,
  UpdateConversationRequest
} from "../../../contracts/ConversationContracts";
import type { MessagingServices } from "../composition/composeMessagingServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeConversationsRequest — `/conversations`: la bandeja.
//
//   GET    /conversations                     chats por páginas (filter, search,
//                                             connectionId, labelIds=a,b, from,
//                                             to, cursor)
//   GET    /conversations/:id                 un chat
//   GET    /conversations/:id/messages        hilo (?before=<id> para más antiguos)
//   GET    /conversations/:id/live            chat abierto en vivo (?since=<cursor>:
//                                             solo lo nuevo o cambiado)
//   POST   /conversations/:id/read            marcar como leído
//   PATCH  /conversations/:id                 { botEnabled }
//   POST   /conversations/:id/messages        responder como asesor (pausa el bot):
//                                             { text } o { parts, replyToId }
//   POST   /conversations/:id/messages/:mid/reaction  reaccionar { emoji }
//   DELETE /conversations/:id                 eliminar el chat y su historial
//   PUT    /conversations/:id/labels          etiquetas del cliente { labelIds }
//   POST   /conversations/:id/flows           enviar un flujo a mano
//
// Ver exige conversations.read; eliminar, conversations.manage; todo lo
// demás, conversations.write. Marcar como leído es lectura: no cambia nada
// del cliente.
// ---------------------------------------------------------------------------

const ITEM = /^\/conversations\/([^/]+)$/;
const MESSAGES = /^\/conversations\/([^/]+)\/messages$/;
const READ = /^\/conversations\/([^/]+)\/read$/;
const FLOWS = /^\/conversations\/([^/]+)\/flows$/;
const LABELS = /^\/conversations\/([^/]+)\/labels$/;
const LIVE = /^\/conversations\/([^/]+)\/live$/;
const REACTION = /^\/conversations\/([^/]+)\/messages\/([^/]+)\/reaction$/;

/** Texto de la URL o nada (un parámetro vacío es como si no estuviera). */
const textParam = (url: URL, name: string): string | undefined => url.searchParams.get(name)?.trim() || undefined;

export async function routeConversationsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: MessagingServices,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/conversations" && !path.startsWith("/conversations/")) return false;

  const { tenantId } = context;
  const method = request.method ?? "GET";
  const isRead = method === "GET" || READ.test(path);
  const isDelete = method === "DELETE" && ITEM.test(path);
  requireScope(context, isRead ? ConversationPermissions.read : isDelete ? ConversationPermissions.manage : ConversationPermissions.write, tenantId);
  const inbox = services.conversations;

  if (path === "/conversations" && method === "GET") {
    const labelIds = textParam(url, "labelIds")?.split(",").filter(Boolean);
    const query = {
      filter: (textParam(url, "filter") ?? "all") as ConversationFilter,
      search: textParam(url, "search"),
      connectionId: textParam(url, "connectionId"),
      labelIds,
      from: textParam(url, "from"),
      to: textParam(url, "to"),
      cursor: textParam(url, "cursor")
    };
    const defined = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
    sendJson(response, 200, { ...(await inbox.list(tenantId, defined)), canManage: context.scopes.includes(ConversationPermissions.manage) });
    return true;
  }

  const live = LIVE.exec(path);
  if (live && method === "GET") {
    sendJson(response, 200, await inbox.live(tenantId, live[1]!, textParam(url, "since")));
    return true;
  }

  const messages = MESSAGES.exec(path);
  if (messages && method === "GET") {
    sendJson(response, 200, await inbox.messages(tenantId, messages[1]!, url.searchParams.get("before") ?? undefined));
    return true;
  }
  if (messages && method === "POST") {
    const body = await parseJsonBody<unknown>(request);
    sendJson(response, 200, await inbox.sendAgentMessage(tenantId, messages[1]!, body, { id: context.actorId, name: null }));
    return true;
  }

  const reaction = REACTION.exec(path);
  if (reaction && method === "POST") {
    const body = await parseJsonBody<Partial<ReactToMessageRequest>>(request);
    await inbox.react(tenantId, reaction[1]!, decodeURIComponent(reaction[2]!), body.emoji, { id: context.actorId, name: null });
    response.statusCode = 204;
    response.end();
    return true;
  }

  const read = READ.exec(path);
  if (read && method === "POST") {
    await inbox.markRead(tenantId, read[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  const labels = LABELS.exec(path);
  if (labels && method === "PUT") {
    const body = await parseJsonBody<Partial<SetConversationLabelsRequest>>(request);
    sendJson(response, 200, await inbox.setLabels(tenantId, labels[1]!, body.labelIds));
    return true;
  }

  const flows = FLOWS.exec(path);
  if (flows && method === "POST") {
    const body = await parseJsonBody<Partial<StartFlowRequest>>(request);
    sendJson(response, 200, await inbox.startFlow(tenantId, flows[1]!, body.automationId));
    return true;
  }

  const item = ITEM.exec(path);
  if (item && method === "GET") {
    sendJson(response, 200, await inbox.get(tenantId, item[1]!));
    return true;
  }
  if (item && method === "DELETE") {
    await inbox.remove(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }
  if (item && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdateConversationRequest>>(request);
    sendJson(response, 200, await inbox.setBotEnabled(tenantId, item[1]!, body.botEnabled));
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
