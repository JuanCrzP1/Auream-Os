import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CrmPermissions } from "../../../platform/authorization/permissions/CrmPermissions";
import type { SaveFollowUpRequest, UpdateFollowUpRequest } from "../../../contracts/CrmActivityContracts";
import type { CrmActor } from "../../../domains/crm/application/crmViews";
import type { DealServices } from "../../../domains/crm/application/DealServices";
import type { FollowUpServices } from "../../../domains/crm/application/FollowUpServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// CRM: seguimientos y la ficha de un cliente.
//
//   GET    /crm/follow-ups?bucket&assignee=all   Vencidos · Hoy · Próximos · Hechos (crm.read)
//   POST   /crm/follow-ups                       crear                     (crm.write)
//   PATCH  /crm/follow-ups/:id                   cambiar o marcar hecho    (crm.write)
//   DELETE /crm/follow-ups/:id                   quitar                    (crm.write)
//   GET    /crm/contacts/:id                     etapas, valor, seguimientos e historial (crm.read)
// ---------------------------------------------------------------------------

const FOLLOW_UP = /^\/crm\/follow-ups\/([0-9a-f-]{36})$/i;
const CONTACT = /^\/crm\/contacts\/([0-9a-f-]{36})$/i;

export async function routeCrmActivity(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  module: { readonly deals: DealServices; readonly followUps: FollowUpServices },
  context: RequestContext,
  actor: CrmActor
): Promise<boolean> {
  const path = url.pathname;
  const method = request.method ?? "GET";
  const { tenantId } = context;

  const contact = CONTACT.exec(path);
  if (contact && method === "GET") {
    requireScope(context, CrmPermissions.read, tenantId);
    sendJson(response, 200, await module.deals.contact(actor, contact[1]!));
    return true;
  }

  const followUp = FOLLOW_UP.exec(path);
  if (path !== "/crm/follow-ups" && !followUp) return false;

  if (path === "/crm/follow-ups" && method === "GET") {
    requireScope(context, CrmPermissions.read, tenantId);
    const filters = { bucket: url.searchParams.get("bucket") ?? undefined, assignee: url.searchParams.get("assignee") ?? undefined };
    sendJson(response, 200, await module.followUps.list(actor, filters));
    return true;
  }

  requireScope(context, CrmPermissions.write, tenantId);
  if (path === "/crm/follow-ups" && method === "POST") {
    sendJson(response, 201, await module.followUps.create(actor, await parseJsonBody<Partial<SaveFollowUpRequest>>(request)));
    return true;
  }
  if (followUp && method === "PATCH") {
    sendJson(response, 200, await module.followUps.update(actor, followUp[1]!, await parseJsonBody<Partial<UpdateFollowUpRequest>>(request)));
    return true;
  }
  if (followUp && method === "DELETE") {
    await module.followUps.remove(actor, followUp[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
