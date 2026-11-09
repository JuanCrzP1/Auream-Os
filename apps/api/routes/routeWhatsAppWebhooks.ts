import type { IncomingMessage, ServerResponse } from "node:http";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import { UAZAPI_WEBHOOK_PATH } from "../composition/composeConnectionsServices";
import { UAZAPI_INSTANCE_PREFIX } from "../../../infrastructure/whatsapp/uazapi/UazapiLinker";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Avisos de los proveedores de WhatsApp. Pública (el proveedor no tiene sesión
// en Auream): un aviso solo cambia algo si trae el token de la instancia de
// ESA conexión, y se responde igual se reconozca o no (no revela qué existe).
//
//   POST /webhooks/uazapi   evento `connection` de uazapi
// ---------------------------------------------------------------------------

const MAX_WEBHOOK_BYTES = 64 * 1024;
const STATUSES = new Set(["connected", "connecting", "disconnected"]);

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function routeWhatsAppWebhooks(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ConnectionsServices
): Promise<boolean> {
  if (url.pathname !== UAZAPI_WEBHOOK_PATH) return false;
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }

  const body = await parseJsonBody<Record<string, unknown>>(request, MAX_WEBHOOK_BYTES);
  const instance = typeof body["instance"] === "object" && body["instance"] !== null ? (body["instance"] as Record<string, unknown>) : {};
  const instanceName = text(body["instanceName"]) || text(instance["name"]);
  const status = text(instance["status"]);

  if (text(body["EventType"]) === "connection" && instanceName.startsWith(UAZAPI_INSTANCE_PREFIX) && STATUSES.has(status)) {
    await services.providerEvents.execute({
      connectionId: instanceName.slice(UAZAPI_INSTANCE_PREFIX.length),
      secret: text(body["token"]),
      status: status as "connected" | "connecting" | "disconnected",
      phoneNumber: text(body["owner"]) || null
    });
  }
  sendJson(response, 200, { received: true });
  return true;
}
