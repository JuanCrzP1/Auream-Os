import type { WhatsAppConnection } from "../../domain/WhatsAppConnection";

// ---------------------------------------------------------------------------
// WhatsAppLinker — vincular y desvincular un número de WhatsApp.
//
//   QR         → proveedor externo que mantiene la sesión (se elige al contratarlo)
//   API oficial → Meta (WhatsApp Business Platform)
//
// Mientras no haya proveedor configurado, la composición inyecta
// `UnconfiguredWhatsAppLinker`, que lo dice en lugar de fingir un QR.
// ---------------------------------------------------------------------------

export type LinkOutcome =
  | { readonly kind: "qr"; readonly qrImage: string; readonly expiresAt: string; readonly providerRef: string }
  | { readonly kind: "connected"; readonly phoneNumber: string; readonly profileName: string | null; readonly providerRef: string }
  | { readonly kind: "unavailable"; readonly message: string };

export interface WhatsAppLinker {
  /** Empieza (o renueva) la vinculación: un QR para escanear o la conexión hecha. */
  link(connection: WhatsAppConnection): Promise<LinkOutcome>;
  /** Cierra la sesión en el proveedor. No falla si ya estaba cerrada. */
  unlink(connection: WhatsAppConnection): Promise<void>;
}
