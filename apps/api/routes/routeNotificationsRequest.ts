import type { IncomingMessage, ServerResponse } from "node:http";
import type { NotificationKind } from "../../../contracts/NotificationContracts";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { BroadcastPermissions } from "../../../platform/authorization/permissions/BroadcastPermissions";
import { ConnectionPermissions } from "../../../platform/authorization/permissions/ConnectionPermissions";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import { CrmPermissions } from "../../../platform/authorization/permissions/CrmPermissions";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";
import { GroupPermissions } from "../../../platform/authorization/permissions/GroupPermissions";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { NotificationServices, NotificationViewer } from "../../../domains/notifications/application/NotificationServices";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// La campana (toda persona con sesión; cada aviso solo si puede ver su módulo).
//
//   GET  /notifications        los avisos y cuántos son nuevos
//   POST /notifications/seen   abrió la campana: lo de hasta ahora deja de ser nuevo
// ---------------------------------------------------------------------------

/**
 * Los permisos que pide cada aviso: el de leer el módulo donde se resuelve.
 * Una falla de flujo ocurre en los chats: pide ver flujos y chats (así una
 * clave de máquina con permiso de flujos no recibe la campana).
 */
const NEEDS: Record<NotificationKind, ReadonlyArray<Scope>> = {
  number_disconnected: [ConnectionPermissions.read],
  broadcast_auto_paused: [BroadcastPermissions.read],
  sales_review: [SalesPermissions.read],
  follow_ups_due: [CrmPermissions.read],
  group_created: [GroupPermissions.read],
  flow_failures: [FlowPermissions.read, ConversationPermissions.read]
};

export function notificationViewer(context: RequestContext): NotificationViewer {
  const kinds = (Object.keys(NEEDS) as NotificationKind[]).filter((kind) => NEEDS[kind].every((scope) => context.scopes.includes(scope)));
  return { tenantId: context.tenantId, userId: context.actorId, kinds: new Set(kinds) };
}

export async function routeNotificationsRequest(request: IncomingMessage, response: ServerResponse, url: URL, services: NotificationServices | undefined, context: RequestContext): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/notifications" && path !== "/notifications/seen") return false;
  if (!services) {
    sendJson(response, 503, { message: "Las notificaciones no están disponibles en este servidor." });
    return true;
  }
  const method = request.method ?? "GET";
  if (path === "/notifications" && method === "GET") {
    sendJson(response, 200, await services.feed(notificationViewer(context)));
    return true;
  }
  if (path === "/notifications/seen" && method === "POST") {
    await services.markSeen(notificationViewer(context));
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
