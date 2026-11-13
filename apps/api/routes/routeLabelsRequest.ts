import type { IncomingMessage, ServerResponse } from "node:http";
import type { UpdateLabelRequest } from "../../../contracts/ContactContracts";
import type { MergeLabelsRequest } from "../../../contracts/LabelManagementContracts";
import type { LabelActor, LabelManagementServices } from "../../../domains/labels/application/LabelManagementServices";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Etiquetas (Configuración › Datos › Etiquetas). Listar y crear siguen en
// `routeContactsRequest` (`GET`/`POST /labels`).
//
//   GET    /labels/overview          clientes, ventas 30 d, quién la usa, repetidas   contacts.read
//   PATCH  /labels/:id               color (contacts.write) · nombre (contacts.manage: cambia en flujos y webhooks)
//   POST   /labels/merge             unir { from, into }                             contacts.manage
//   DELETE /labels/:id[?into=<id>]   borrar (si nadie la usa) o pasar y borrar        contacts.manage
//
// Lo que vendieron solo lo ve quien ve ventas (`sales.read`).
// ---------------------------------------------------------------------------

const ITEM = /^\/labels\/([^/]+)$/;

export async function routeLabelsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: LabelManagementServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  const method = request.method ?? "GET";
  const item = ITEM.exec(path);
  const mine = path === "/labels/overview" || path === "/labels/merge" || (item !== null && (method === "PATCH" || method === "DELETE"));
  if (!mine || !services) return false;

  const { tenantId } = context;
  requireScope(context, ContactPermissions.read, tenantId);
  const actor: LabelActor = {
    tenantId,
    actorId: context.actorId,
    canManage: context.scopes.includes(ContactPermissions.manage),
    canEdit: context.scopes.includes(ContactPermissions.write),
    canSeeSales: context.scopes.includes(SalesPermissions.read)
  };

  if (path === "/labels/overview" && method === "GET") {
    sendJson(response, 200, await services.overview(actor));
    return true;
  }
  if (path === "/labels/merge" && method === "POST") {
    requireScope(context, ContactPermissions.manage, tenantId);
    sendJson(response, 202, await services.merge(actor, await parseJsonBody<Partial<MergeLabelsRequest>>(request)));
    return true;
  }
  if (item && method === "PATCH") {
    // El color lo cambia quien edita contactos; el nombre lo revisa el servicio (dueños y administradores).
    requireScope(context, ContactPermissions.write, tenantId);
    const result = await services.update(actor, item[1]!, await parseJsonBody<Partial<UpdateLabelRequest>>(request));
    sendJson(response, 200, { ...result.label, flowsSkipped: result.flowsSkipped });
    return true;
  }
  if (item && method === "DELETE") {
    requireScope(context, ContactPermissions.manage, tenantId);
    const merged = await services.remove(actor, item[1]!, url.searchParams.get("into"));
    sendJson(response, merged ? 202 : 200, merged ?? { deleted: true });
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
