import type { IncomingMessage, ServerResponse } from "node:http";
import type { ConnectionsServices } from "../composition/composeConnectionsServices";
import { UAZAPI_WEBHOOK_PATH } from "../composition/composeConnectionsServices";
import type { MessagingServices } from "../composition/composeMessagingServices";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import { UAZAPI_INSTANCE_PREFIX } from "../../../infrastructure/whatsapp/uazapi/UazapiLinker";
import { parseUazapiMessage } from "../../../infrastructure/whatsapp/uazapi/parseUazapiMessage";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Avisos de los proveedores de WhatsApp. Pública (el proveedor no tiene sesión
// en Auream): un aviso solo vale si trae el token de la instancia de ESA
// conexión, y se responde igual se reconozca o no (no revela qué existe).
//
//   POST /webhooks/uazapi
//     connection  la conexión se conectó o desconectó
//     messages    un cliente escribió: se responde enseguida (uazapi lo pide)
//                 y el mensaje se procesa después (`BackgroundTasks`)
// ---------------------------------------------------------------------------

const MAX_WEBHOOK_BYTES = 256 * 1024;
const STATUSES = new Set(["connected", "connecting", "disconnected"]);

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** `auream-<id>` → id de la conexión. */
function connectionIdOf(instanceName: string): string | null {
  return instanceName.startsWith(UAZAPI_INSTANCE_PREFIX) ? instanceName.slice(UAZAPI_INSTANCE_PREFIX.length) : null;
}

export async function routeWhatsAppWebhooks(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  connections: ConnectionsServices,
  messaging?: MessagingServices,
  background?: BackgroundTasks
): Promise<boolean> {
  if (url.pathname !== UAZAPI_WEBHOOK_PATH) return false;
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }

  const body = await parseJsonBody<Record<string, unknown>>(request, MAX_WEBHOOK_BYTES);
  const eventType = text(body["EventType"]);

  if (eventType === "connection") {
    const instance = typeof body["instance"] === "object" && body["instance"] !== null ? (body["instance"] as Record<string, unknown>) : {};
    const connectionId = connectionIdOf(text(body["instanceName"]) || text(instance["name"]));
    const status = text(instance["status"]);
    if (connectionId && STATUSES.has(status)) {
      await connections.providerEvents.execute({
        connectionId,
        secret: text(body["token"]),
        status: status as "connected" | "connecting" | "disconnected",
        phoneNumber: text(body["owner"]) || null
      });
    }
  }

  if (eventType === "messages" && messaging && background) {
    const parsed = parseUazapiMessage(body);
    const connectionId = parsed.ok ? connectionIdOf(parsed.event.instanceName) : null;
    if (parsed.ok && connectionId) {
      const { event } = parsed;
      background.run(async () => {
        const connection = await connections.channel.authenticate(connectionId, event.token);
        if (!connection) return;
        // Archivo sin enlace en el aviso: se pide a uazapi (válido 2 días).
        const media = event.needsMediaDownload ? await connections.channel.inboundMedia(connection, event.message.providerMessageId) : event.message.media;
        await messaging.inbound.execute(connection.tenantId, { ...event.message, connectionId: connection.id, media });
      });
    }
  }

  sendJson(response, 200, { received: true });
  return true;
}
