import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { TeamPermissions } from "../../../platform/authorization/permissions/TeamPermissions";
import type { NotificationActor, NotificationSettingsServices } from "../../../domains/notifications/application/NotificationSettingsServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Configuración › Tu cuenta › Notificaciones. Lo de cada persona: sus
// dispositivos y qué le suena en esta empresa. Solo personas del equipo
// (`team.read`); una credencial o la clave de desarrollo no tienen dispositivos.
//
//   GET    /notifications/settings                 lo que ve la página
//   PUT    /notifications/settings/topics/:topic   { enabled }
//   POST   /notifications/push/devices             activar este dispositivo
//   DELETE /notifications/push/devices/:id         quitarlo
//   POST   /notifications/push/devices/:id/test    «Enviar una prueba»
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPIC = /^\/notifications\/settings\/topics\/([a-z_]{1,40})$/;
const DEVICE = /^\/notifications\/push\/devices\/([0-9a-f-]{36})(\/test)?$/i;

export async function routeNotificationSettingsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  settings: NotificationSettingsServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (!path.startsWith("/notifications/settings") && !path.startsWith("/notifications/push")) return false;
  if (!settings) {
    sendJson(response, 503, { message: "Las notificaciones no están disponibles en este servidor." });
    return true;
  }
  requireScope(context, TeamPermissions.read, context.tenantId);
  if (!UUID.test(context.actorId)) {
    sendJson(response, 403, { message: "Las notificaciones son de cada persona del equipo: entra con tu cuenta." });
    return true;
  }
  const actor: NotificationActor = { tenantId: context.tenantId, userId: context.actorId, scopes: context.scopes };
  const method = request.method ?? "GET";

  if (path === "/notifications/settings" && method === "GET") {
    sendJson(response, 200, await settings.view(actor));
    return true;
  }
  const topic = TOPIC.exec(path);
  if (topic && method === "PUT") {
    const body = await parseJsonBody<{ enabled?: unknown }>(request);
    sendJson(response, 200, await settings.setTopic(actor, topic[1], body.enabled));
    return true;
  }
  if (path === "/notifications/push/devices" && method === "POST") {
    sendJson(response, 201, await settings.subscribe(actor, await parseJsonBody(request)));
    return true;
  }
  const device = DEVICE.exec(path);
  if (device && !device[2] && method === "DELETE") {
    sendJson(response, 200, await settings.removeDevice(actor, device[1]!));
    return true;
  }
  if (device && device[2] && method === "POST") {
    sendJson(response, 200, await settings.test(actor, device[1]!));
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
