import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CredentialPermissions } from "../../../platform/authorization/permissions/CredentialPermissions";
import type { CreateWebhookRequest, UpdateWebhookRequest } from "../../../contracts/WebhookContracts";
import type { WebhookServices } from "../composition/composeWebhookServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `/inbound-webhooks` — administrar los webhooks de entrada de la cuenta.
// Llevan una dirección secreta y pueden iniciar flujos: como las demás
// integraciones, exigen `credentials.write` (dueños y administradores).
//
//   GET    /inbound-webhooks                 lista (con lo recibido en el mes)
//   POST   /inbound-webhooks                 crear (nombre y número opcional)
//   GET    /inbound-webhooks/:id             detalle (dirección y último ejemplo)
//   PATCH  /inbound-webhooks/:id             nombre, activo, número, mapeo
//   DELETE /inbound-webhooks/:id
//   GET    /inbound-webhooks/:id/deliveries  historial de envíos
// ---------------------------------------------------------------------------

const ITEM = /^\/inbound-webhooks\/([^/]+)$/;
const DELIVERIES = /^\/inbound-webhooks\/([^/]+)\/deliveries$/;

export async function routeWebhooksRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: WebhookServices | null,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/inbound-webhooks" && !path.startsWith("/inbound-webhooks/")) return false;
  const { tenantId } = context;
  requireScope(context, CredentialPermissions.write, tenantId);
  if (!services) {
    sendJson(response, 503, { message: "Los webhooks no están disponibles: falta configurar el cifrado (CREDENTIALS_ENCRYPTION_KEY)." });
    return true;
  }
  const method = request.method ?? "GET";
  const admin = services.admin;

  if (path === "/inbound-webhooks" && method === "GET") {
    sendJson(response, 200, { webhooks: await admin.list(tenantId) });
    return true;
  }
  if (path === "/inbound-webhooks" && method === "POST") {
    sendJson(response, 201, await admin.create(tenantId, await parseJsonBody<CreateWebhookRequest>(request)));
    return true;
  }
  const deliveries = DELIVERIES.exec(path);
  if (deliveries && method === "GET") {
    sendJson(response, 200, { deliveries: await admin.history(tenantId, deliveries[1]!) });
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "GET") {
    sendJson(response, 200, await admin.get(tenantId, item[1]!));
    return true;
  }
  if (item && method === "PATCH") {
    sendJson(response, 200, await admin.update(tenantId, item[1]!, await parseJsonBody<UpdateWebhookRequest>(request)));
    return true;
  }
  if (item && method === "DELETE") {
    await admin.remove(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
