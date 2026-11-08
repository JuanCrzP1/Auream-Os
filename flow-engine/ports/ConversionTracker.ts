// ---------------------------------------------------------------------------
// ConversionTracker — lo que el bloque «Pixel» necesita para registrar una
// conversión (Lead, Compra) en la API de Conversiones de Meta.
//
//   PixelNodeHandler → ConversionTracker (este puerto) → píxel de la cuenta → Meta
//
// El motor nunca ve el token del píxel: pide «registra este evento con la
// conexión X» y la composición descifra el token y llama a Meta
// (`VaultConversionTracker`). Los datos del cliente viajan en claro hasta el
// adaptador, que los normaliza y los cifra con SHA-256 como exige Meta.
// ---------------------------------------------------------------------------

/** Nombre del evento en Meta. `LeadSubmitted` es el Lead de clic a WhatsApp. */
export type ConversionEventName = "Lead" | "LeadSubmitted" | "Purchase";

/**
 *   chat                conversación de WhatsApp sin anuncio identificado
 *   business_messaging  conversación que nació de un anuncio de clic a
 *                       WhatsApp (con `ctwaClid` y `pageId`): se atribuye a él
 */
export type ConversionActionSource = "chat" | "business_messaging";

export interface ConversionUser {
  readonly phone?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  /** Id estable del contacto en Auream (Meta lo recibe cifrado). */
  readonly externalId: string;
  /** Id del clic en el anuncio de clic a WhatsApp. */
  readonly ctwaClid?: string;
  /** Página de Facebook del anuncio. */
  readonly pageId?: string;
}

export interface ConversionEvent {
  readonly name: ConversionEventName;
  /** Para que Meta descarte duplicados del mismo evento. */
  readonly eventId: string;
  /** Segundos Unix. */
  readonly eventTime: number;
  readonly actionSource: ConversionActionSource;
  readonly user: ConversionUser;
  readonly value?: number;
  /** ISO 4217. */
  readonly currency?: string;
}

export interface TrackConversionRequest {
  /** Conexión de píxel de la cuenta (`pixel_connections.id`). */
  readonly connectionId: string;
  readonly event: ConversionEvent;
  /** Código de «Probar eventos»: el evento se ve ahí y no cuenta como real. */
  readonly testEventCode?: string;
}

/**
 * Por qué no se registró:
 *   connection_not_found  el píxel no existe (borrado) o es de otra cuenta
 *   invalid_token         Meta rechazó el token
 *   pixel_not_found       el token no tiene acceso a ese píxel
 *   invalid_event         Meta rechazó el evento (datos o parámetros)
 *   rate_limited · timeout · network_error · provider_error
 *   unavailable           este entorno no envía eventos (tests)
 */
export type ConversionFailureReason =
  | "connection_not_found"
  | "invalid_token"
  | "pixel_not_found"
  | "invalid_event"
  | "rate_limited"
  | "timeout"
  | "network_error"
  | "provider_error"
  | "unavailable";

export type TrackConversionResult =
  | { readonly ok: true; readonly eventsReceived: number }
  | { readonly ok: false; readonly reason: ConversionFailureReason; readonly message: string };

export interface ConversionTracker {
  track(tenantId: string, request: TrackConversionRequest): Promise<TrackConversionResult>;
}
