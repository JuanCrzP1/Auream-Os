// ---------------------------------------------------------------------------
// WhatsAppLinker — vincular, consultar y desvincular un número de WhatsApp.
//
//   QR          → proveedor externo que mantiene la sesión (uazapi)
//   API oficial → Meta (WhatsApp Business Platform), fase siguiente
//
// La credencial de la sesión (`ProviderSession.secret`) viaja aquí en claro
// solo en memoria: el caso de uso la cifra antes de guardarla y la descifra
// para entregarla. Mientras no haya proveedor, `UnconfiguredWhatsAppLinker`
// lo dice en lugar de fingir un QR.
// ---------------------------------------------------------------------------

import type { ConnectionMethod } from "../../../../contracts/ConnectionContracts";

export interface ProviderSession {
  /** Identificador de la sesión en el proveedor (no es secreto). */
  readonly ref: string;
  /** Credencial de la sesión. Secreta. */
  readonly secret: string;
}

export interface LinkTarget {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly method: ConnectionMethod;
}

/** Cómo está la sesión en el proveedor. */
export type SessionState =
  | { readonly kind: "qr"; readonly qrImage: string }
  | { readonly kind: "connected"; readonly phoneNumber: string; readonly profileName: string | null; readonly profilePictureUrl: string | null }
  | { readonly kind: "disconnected" };

export type StartOutcome =
  | (SessionState & { readonly session: ProviderSession })
  | { readonly kind: "unavailable"; readonly message: string };

/** Falla del proveedor (caído, credencial rechazada…). Mensaje sin secretos. */
export class LinkerError extends Error {}

/**
 * El proveedor ya no tiene esta sesión (la borró, venció o su credencial dejó
 * de valer; p. ej. el servidor gratuito de uazapi borra las instancias solo).
 * Para Auream el número quedó DESCONECTADO: «Reconectar» crea una sesión nueva.
 */
export class SessionGoneError extends LinkerError {}

export interface WhatsAppLinker {
  /**
   * Empieza o retoma la vinculación. Con `session` reutiliza la sesión que ya
   * existe en el proveedor; sin ella (o si el proveedor ya no la tiene) crea
   * una nueva. Lanza `LinkerError` si el proveedor falla.
   */
  start(target: LinkTarget, session: ProviderSession | null): Promise<StartOutcome>;
  /**
   * Descarta la vinculación en curso y empieza otra con un código nuevo
   * (reinicia el tiempo para escanear). Lanza `LinkerError` si el proveedor falla.
   */
  restart(session: ProviderSession): Promise<SessionState>;
  /**
   * Pone al día la configuración de una sesión ya conectada (p. ej. los avisos
   * que manda el proveedor, si la versión de Auream pide nuevos). Idempotente.
   * Lanza `SessionGoneError` si la sesión ya no existe.
   */
  refresh(session: ProviderSession): Promise<void>;
  /** Estado actual de la sesión. Lanza `LinkerError` si el proveedor falla. */
  check(session: ProviderSession): Promise<SessionState>;
  /**
   * Cierra la sesión de WhatsApp (el número deja de estar vinculado) pero
   * CONSERVA la sesión en el proveedor: reconectar pide un QR nuevo sobre ella.
   * Lanza `SessionGoneError` si la sesión ya no existe; `LinkerError` si el proveedor falla.
   */
  disconnect(session: ProviderSession): Promise<void>;
  /**
   * Retoma la conexión de un número vinculado sin perder la vinculación (para
   * cuando no recibe o no envía). Lanza `SessionGoneError` si la sesión ya no
   * existe; `LinkerError` si el proveedor falla.
   */
  reset(session: ProviderSession): Promise<void>;
  /** Cierra y borra la sesión en el proveedor. No falla si ya no existía. */
  unlink(session: ProviderSession): Promise<void>;
}

/** El proveedor de cada forma de conectar (QR → uazapi; API oficial → Meta). */
export interface WhatsAppLinkers {
  for(method: ConnectionMethod): WhatsAppLinker;
}
