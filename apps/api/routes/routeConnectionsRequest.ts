import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ConnectionPermissions } from "../../../platform/authorization/permissions/ConnectionPermissions";
import type { CreateConnectionRequest, LinkConnectionRequest, UpdateConnectionRequest } from "../../../contracts/ConnectionContracts";
import type { SaveConnectionTriggerRequest } from "../../../contracts/ConnectionTriggerContracts";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeConnectionsRequest — `/connections`: los números de WhatsApp.
//
//   GET    /connections            lista (connections.read)
//   POST   /connections            crear (connections.write)
//   PATCH  /connections/:id        renombrar
//   DELETE /connections/:id        eliminar (cierra la sesión en el proveedor)
//   POST   /connections/:id/link   vincular o reconectar: QR o conexión hecha ({ restart } = código nuevo)
//   GET    /connections/:id/status cómo va la vinculación (QR renovado, conectada…)
//   GET    /connections/:id/triggers              disparadores del número
//   POST   /connections/:id/triggers              crear uno
//   PATCH  /connections/:id/triggers/:triggerId   cambiarlo (o activarlo/pausarlo)
//   DELETE /connections/:id/triggers/:triggerId   quitarlo
// ---------------------------------------------------------------------------

const ITEM = /^\/connections\/([^/]+)$/;
const LINK = /^\/connections\/([^/]+)\/link$/;
const STATUS = /^\/connections\/([^/]+)\/status$/;
const TRIGGERS = /^\/connections\/([^/]+)\/triggers$/;
const TRIGGER = /^\/connections\/([^/]+)\/triggers\/([^/]+)$/;

export async function routeConnectionsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ConnectionsServices,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/connections" && !path.startsWith("/connections/")) return false;

  const { tenantId } = context;
  const method = request.method ?? "GET";
  requireScope(context, method === "GET" ? ConnectionPermissions.read : ConnectionPermissions.write, tenantId);

  if (path === "/connections" && method === "GET") {
    sendJson(response, 200, { connections: await services.list.execute(tenantId) });
    return true;
  }
  if (path === "/connections" && method === "POST") {
    const body = await parseJsonBody<Partial<CreateConnectionRequest>>(request);
    sendJson(response, 201, await services.create.execute(tenantId, body));
    return true;
  }

  const triggers = TRIGGERS.exec(path);
  if (triggers && method === "GET") {
    sendJson(response, 200, { triggers: await services.triggers.list(tenantId, triggers[1]!) });
    return true;
  }
  if (triggers && method === "POST") {
    const body = await parseJsonBody<Partial<SaveConnectionTriggerRequest>>(request);
    sendJson(response, 201, await services.triggers.create(tenantId, triggers[1]!, body));
    return true;
  }
  const trigger = TRIGGER.exec(path);
  if (trigger && method === "PATCH") {
    const body = await parseJsonBody<Partial<SaveConnectionTriggerRequest>>(request);
    sendJson(response, 200, await services.triggers.update(tenantId, trigger[1]!, trigger[2]!, body));
    return true;
  }
  if (trigger && method === "DELETE") {
    await services.triggers.remove(tenantId, trigger[1]!, trigger[2]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  const status = STATUS.exec(path);
  if (status && method === "GET") {
    sendJson(response, 200, await services.check.execute(tenantId, status[1]!));
    return true;
  }

  const link = LINK.exec(path);
  if (link && method === "POST") {
    const body = await parseJsonBody<Partial<LinkConnectionRequest>>(request);
    sendJson(response, 200, await services.link.execute(tenantId, link[1]!, { restart: body.restart === true }));
    return true;
  }

  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdateConnectionRequest>>(request);
    sendJson(response, 200, await services.rename.execute(tenantId, item[1]!, body));
    return true;
  }
  if (item && method === "DELETE") {
    await services.remove.execute(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
