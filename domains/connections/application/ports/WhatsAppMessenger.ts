import type { ConnectionMethod } from "../../../../contracts/ConnectionContracts";
import type { ChatPresence, OutboundMessage } from "../../../../contracts/RuntimeContracts";
import type { ProviderSession } from "./WhatsAppLinker";

// ---------------------------------------------------------------------------
// WhatsAppMessenger — enviar y recibir archivos por una sesión del proveedor.
// Lo cumple cada proveedor (QR → uazapi; API oficial → Meta, fase siguiente).
// Lanza `MessengerError` (mensaje sin secretos) si el proveedor falla.
// ---------------------------------------------------------------------------

export class MessengerError extends Error {}

export interface WhatsAppMessenger {
  /**
   * Envía una salida del flujo (texto, archivo, botones/lista o reacción). Las
   * pausas no llegan aquí. Devuelve el id que WhatsApp le dio al mensaje (con
   * él llegan después los avisos de entregado y leído), si el proveedor lo da.
   */
  send(session: ProviderSession, phone: string, message: OutboundMessage): Promise<{ readonly providerMessageId: string | null }>;
  /**
   * Muestra al cliente «escribiendo…» o «grabando audio…» durante `durationMs`
   * (se quita sola al llegar el mensaje). No espera: lo mantiene el proveedor.
   */
  presence(session: ProviderSession, phone: string, presence: ChatPresence, durationMs: number): Promise<void>;
  /** Enlace para descargar un archivo que envió el cliente. */
  inboundMedia(session: ProviderSession, providerMessageId: string): Promise<{ readonly url: string; readonly mimeType: string | null }>;
  /** Foto de perfil de un contacto (enlace temporal, miniatura); `null` si no tiene o no se puede ver. */
  profilePicture(session: ProviderSession, phone: string): Promise<string | null>;
}

export interface WhatsAppMessengers {
  for(method: ConnectionMethod): WhatsAppMessenger | null;
}
