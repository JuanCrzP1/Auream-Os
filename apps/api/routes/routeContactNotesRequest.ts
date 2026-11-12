import type { IncomingMessage, ServerResponse } from "node:http";
import type { CreateContactNoteRequest } from "../../../contracts/ContactNoteContracts";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import type { ContactNoteServices } from "../../../domains/contacts/application/ContactNoteServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeContactNotesRequest — notas internas de un cliente.
//
//   GET    /contacts/:id/notes            las notas (más nuevas primero)   contacts.read
//   POST   /contacts/:id/notes            anotar { body }                   contacts.write
//   DELETE /contacts/:id/notes/:noteId    borrar (su autor, o dueños y      contacts.write
//                                         administradores)
// ---------------------------------------------------------------------------

const NOTES = /^\/contacts\/([^/]+)\/notes$/;
const NOTE = /^\/contacts\/([^/]+)\/notes\/([^/]+)$/;

export async function routeContactNotesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ContactNoteServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const notes = NOTES.exec(url.pathname);
  const note = NOTE.exec(url.pathname);
  if (!notes && !note) return false;
  if (!services) {
    sendJson(response, 503, { message: "Las notas no están disponibles en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";
  requireScope(context, method === "GET" ? ContactPermissions.read : ContactPermissions.write, tenantId);
  // Dueños y administradores (los que también eliminan chats) borran cualquier nota.
  const viewer = { userId: context.actorId, canManage: context.scopes.includes(ConversationPermissions.manage) };

  if (notes && method === "GET") {
    sendJson(response, 200, { notes: await services.list(tenantId, notes[1]!, viewer) });
    return true;
  }
  if (notes && method === "POST") {
    const body = await parseJsonBody<Partial<CreateContactNoteRequest>>(request);
    sendJson(response, 201, await services.add(tenantId, notes[1]!, body.body, viewer));
    return true;
  }
  if (note && method === "DELETE") {
    await services.remove(tenantId, note[1]!, note[2]!, viewer);
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
