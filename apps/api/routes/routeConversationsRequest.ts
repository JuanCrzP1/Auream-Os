import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import type {
  ConversationFilter,
  SendAgentMessageRequest,
  StartFlowRequest,
  UpdateConversationRequest
} from "../../../contracts/ConversationContracts";
import type { MessagingServices } from "../composition/composeMessagingServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeConversationsRequest — `/conversations`: la bandeja.
//
//   GET    /conversations                     chats (filter, search, connectionId)
//   GET    /conversations/:id                 un chat
//   GET    /conversations/:id/messages        hilo (?before=<id> para más antiguos)
//   POST   /conversations/:id/read            marcar como leído
//   PATCH  /conversations/:id                 { botEnabled }
//   POST   /conversations/:id/messages        responder como asesor (pausa el bot)
//   POST   /conversations/:id/flows           enviar un flujo a mano
//
// Ver exige conversations.read; todo lo demás, conversations.write. Marcar
// como leído es lectura: no cambia nada del cliente.
// ---------------------------------------------------------------------------

const ITEM = /^\/conversations\/([^/]+)$/;
const MESSAGES = /^\/conversations\/([^/]+)\/messages$/;
const READ = /^\/conversations\/([^/]+)\/read$/;
const FLOWS = /^\/conversations\/([^/]+)\/flows$/;

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
  requireScope(context, isRead ? ConversationPermissions.read : ConversationPermissions.write, tenantId);
  const inbox = services.conversations;

  if (path === "/conversations" && method === "GET") {
    const filter = (url.searchParams.get("filter") ?? "all") as ConversationFilter;
    const search = url.searchParams.get("search") ?? undefined;
    const connectionId = url.searchParams.get("connectionId") ?? undefined;
    sendJson(response, 200, {
      conversations: await inbox.list(tenantId, { filter, ...(search ? { search } : {}), ...(connectionId ? { connectionId } : {}) })
    });
    return true;
  }

  const messages = MESSAGES.exec(path);
  if (messages && method === "GET") {
    sendJson(response, 200, await inbox.messages(tenantId, messages[1]!, url.searchParams.get("before") ?? undefined));
    return true;
  }
  if (messages && method === "POST") {
    const body = await parseJsonBody<Partial<SendAgentMessageRequest>>(request);
    sendJson(response, 200, await inbox.sendAgentMessage(tenantId, messages[1]!, body.text, { id: context.actorId, name: null }));
    return true;
  }

  const read = READ.exec(path);
  if (read && method === "POST") {
    await inbox.markRead(tenantId, read[1]!);
    response.statusCode = 204;
    response.end();
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
  if (item && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdateConversationRequest>>(request);
    sendJson(response, 200, await inbox.setBotEnabled(tenantId, item[1]!, body.botEnabled));
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
