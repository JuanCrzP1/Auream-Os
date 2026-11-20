import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import { GroupPermissions } from "../../../platform/authorization/permissions/GroupPermissions";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { AuditLogger } from "../../../platform/observability/audit/AuditLogger";
import type { GroupMemberActor, GroupMemberServices } from "../../../domains/groups/application/GroupMemberServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendCsvFile } from "../http/sendCsvFile";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Los miembros de un grupo. Son datos de clientes: verlos pide además ver
// contactos; etiquetarlos, editarlos; descargarlos es de dueños y
// administradores y QUEDA REGISTRADO (si no se puede registrar, no sale).
//
//   GET  /groups/list/:id/members?filter&search&offset   (groups.read + contacts.read)
//   POST /groups/list/:id/members/label  {filter,label}  (groups.manage + contacts.write)
//   GET  /groups/list/:id/members/export?filter           (groups.manage + contacts.read)
// ---------------------------------------------------------------------------

const MEMBERS = /^\/groups\/list\/([0-9a-f-]{36})\/members(\/label|\/export)?$/i;

export async function routeGroupMembersRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  members: GroupMemberServices | undefined,
  audit: AuditLogger | undefined,
  context: RequestContext
): Promise<boolean> {
  const match = MEMBERS.exec(url.pathname);
  if (!match) return false;
  if (!members) {
    sendJson(response, 503, { message: "Los miembros de los grupos no están disponibles en este servidor." });
    return true;
  }
  const { tenantId, scopes } = context;
  const groupId = match[1]!;
  const action = match[2]?.toLowerCase() ?? "";
  const method = request.method ?? "GET";
  const actor: GroupMemberActor = {
    tenantId,
    canSeeSales: scopes.includes(SalesPermissions.read),
    canLabel: scopes.includes(GroupPermissions.manage) && scopes.includes(ContactPermissions.write),
    canExport: scopes.includes(GroupPermissions.manage)
  };

  if (action === "" && method === "GET") {
    requireScope(context, GroupPermissions.read, tenantId);
    requireScope(context, ContactPermissions.read, tenantId);
    const query = { filter: url.searchParams.get("filter") ?? undefined, search: url.searchParams.get("search") ?? undefined, offset: url.searchParams.get("offset") ?? undefined };
    sendJson(response, 200, await members.page(actor, groupId, query));
    return true;
  }
  if (action === "/label" && method === "POST") {
    requireScope(context, GroupPermissions.manage, tenantId);
    requireScope(context, ContactPermissions.write, tenantId);
    sendJson(response, 200, await members.label(actor, groupId, await parseJsonBody(request)));
    return true;
  }
  if (action === "/export" && method === "GET") {
    requireScope(context, GroupPermissions.manage, tenantId);
    requireScope(context, ContactPermissions.read, tenantId);
    // Sin registro no hay descarga: nunca sale un archivo con datos de clientes sin dejar rastro.
    if (!audit) {
      sendJson(response, 503, { message: "La descarga no está disponible en este servidor." });
      return true;
    }
    const filter = url.searchParams.get("filter") ?? "all";
    const table = await members.export(actor, groupId, filter);
    await audit.recordDataExport(tenantId, context.actorId, context.requestId, { kind: "group_members", subjectId: groupId, rows: table.rows.length, filters: { filter } });
    sendCsvFile(response, table);
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
