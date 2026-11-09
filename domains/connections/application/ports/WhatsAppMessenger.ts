import type { ConnectionMethod } from "../../../../contracts/ConnectionContracts";
import type { OutboundMessage } from "../../../../contracts/RuntimeContracts";
import type { ProviderSession } from "./WhatsAppLinker";

// ---------------------------------------------------------------------------
// WhatsAppMessenger — enviar y recibir archivos por una sesión del proveedor.
// Lo cumple cada proveedor (QR → uazapi; API oficial → Meta, fase siguiente).
// Lanza `MessengerError` (mensaje sin secretos) si el proveedor falla.
// ---------------------------------------------------------------------------

export class MessengerError extends Error {}

export interface WhatsAppMessenger {
  /** Envía una salida del flujo (texto, archivo, botones/lista o reacción). Las pausas no llegan aquí. */
  send(session: ProviderSession, phone: string, message: OutboundMessage): Promise<void>;
  /** Enlace para descargar un archivo que envió el cliente. */
  inboundMedia(session: ProviderSession, providerMessageId: string): Promise<{ readonly url: string; readonly mimeType: string | null }>;
}

export interface WhatsAppMessengers {
  for(method: ConnectionMethod): WhatsAppMessenger | null;
}
