import type { IncomingMessage, ServerResponse } from "node:http";
import { BUSINESS_DATA_CONFIRM_PARAM, type SaveBusinessDatumRequest } from "../../../contracts/BusinessDataContracts";
import type { SaveBusinessScheduleRequest } from "../../../contracts/BusinessDataTimeline";
import type { BusinessDataServices } from "../../../domains/business-data/application/BusinessDataServices";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConversationPermissions } from "../../../platform/authorization/permissions/ConversationPermissions";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Datos del negocio (Configuración › Campos y datos › Datos del negocio).
//
//   GET    /business-data          los datos, dónde se usan y un mensaje real   flows.read
//   GET    /business-data/values   solo los valores (el chat, las difusiones)   flows.read o conversations.read
//   POST   /business-data          crear { label, type, value, description }   flows.write
//   PATCH  /business-data/:id      cambiar nombre, tipo, valor o descripción    flows.write
//   DELETE /business-data/:id      borrar (?confirm=<clave> si se usa)          flows.write
//   GET    /business-data/:id/history              quién cambió qué y cuándo   flows.read
//   POST   /business-data/:id/schedules            programar otro valor        flows.write
//   PATCH  /business-data/:id/schedules/:sid       editar un programado        flows.write
//   DELETE /business-data/:id/schedules/:sid       quitarlo o terminarlo ya    flows.write
//
// Cambiar uno cambia lo que dicen los flujos: lo hacen quienes editan
// automatizaciones (dueños y administradores). El Asesor los ve y los usa.
// ---------------------------------------------------------------------------

const ITEM = /^\/business-data\/([^/]+)$/;
const HISTORY = /^\/business-data\/([^/]+)\/history$/;
const SCHEDULES = /^\/business-data\/([^/]+)\/schedules$/;
const SCHEDULE = /^\/business-data\/([^/]+)\/schedules\/([^/]+)$/;

export async function routeBusinessDataRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: BusinessDataServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/business-data" && !path.startsWith("/business-data/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Datos del negocio no está disponible en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";

  if (path === "/business-data/values" && method === "GET") {
    // Quien atiende chats los pone en sus respuestas rápidas, aunque no vea los flujos.
    requireScope(context, context.scopes.includes(FlowPermissions.read) ? FlowPermissions.read : ConversationPermissions.read, tenantId);
    sendJson(response, 200, await services.values(tenantId));
    return true;
  }
  if (path === "/business-data" && method === "GET") {
    requireScope(context, FlowPermissions.read, tenantId);
    sendJson(response, 200, await services.list(tenantId, context.scopes.includes(FlowPermissions.write)));
    return true;
  }
  const history = HISTORY.exec(path);
  if (history && method === "GET") {
    requireScope(context, FlowPermissions.read, tenantId);
    sendJson(response, 200, await services.timeline.history(tenantId, history[1]!));
    return true;
  }

  requireScope(context, FlowPermissions.write, tenantId);
  if (path === "/business-data" && method === "POST") {
    sendJson(response, 201, await services.create(tenantId, await parseJsonBody<Partial<SaveBusinessDatumRequest>>(request), context.actorId));
    return true;
  }
  const schedules = SCHEDULES.exec(path);
  if (schedules && method === "POST") {
    sendJson(response, 201, await services.timeline.schedule(tenantId, schedules[1]!, await parseJsonBody<Partial<SaveBusinessScheduleRequest>>(request), context.actorId));
    return true;
  }
  const schedule = SCHEDULE.exec(path);
  if (schedule && method === "PATCH") {
    sendJson(response, 200, await services.timeline.reschedule(tenantId, schedule[1]!, schedule[2]!, await parseJsonBody<Partial<SaveBusinessScheduleRequest>>(request), context.actorId));
    return true;
  }
  if (schedule && method === "DELETE") {
    sendJson(response, 200, await services.timeline.unschedule(tenantId, schedule[1]!, schedule[2]!, context.actorId));
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    sendJson(response, 200, await services.update(tenantId, item[1]!, await parseJsonBody<Partial<SaveBusinessDatumRequest>>(request), context.actorId));
    return true;
  }
  if (item && method === "DELETE") {
    await services.remove(tenantId, item[1]!, url.searchParams.get(BUSINESS_DATA_CONFIRM_PARAM), context.actorId);
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
