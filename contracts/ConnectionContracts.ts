// ---------------------------------------------------------------------------
// Conexiones de WhatsApp de la cuenta (lo que comparten la API y la web).
//
// Dos formas de conectar un número:
//   qr         escaneando un código QR desde WhatsApp en el celular. La sesión
//              la mantiene un proveedor externo (Vercel no puede tener una
//              sesión de WhatsApp Web abierta).
//   cloud_api  la API oficial de Meta (WhatsApp Business Platform).
//
// Estados:
//   pending       creada, todavía sin vincular un número
//   connecting    esperando que se escanee el QR o se complete la vinculación
//   connected     el número envía y recibe mensajes
//   disconnected  estuvo conectada y la sesión se cerró (hay que reconectar)
// ---------------------------------------------------------------------------

export type ConnectionMethod = "qr" | "cloud_api";
export const CONNECTION_METHODS: ReadonlyArray<ConnectionMethod> = ["qr", "cloud_api"];

export type ConnectionStatus = "pending" | "connecting" | "connected" | "disconnected";
export const CONNECTION_STATUSES: ReadonlyArray<ConnectionStatus> = ["pending", "connecting", "connected", "disconnected"];

export const MAX_CONNECTION_NAME = 40;

export interface ConnectionSummary {
  readonly id: string;
  readonly name: string;
  readonly method: ConnectionMethod;
  readonly status: ConnectionStatus;
  /** Número vinculado, solo dígitos con indicativo (`573013815302`). */
  readonly phoneNumber: string | null;
  /** Nombre del perfil de WhatsApp del número vinculado. */
  readonly profileName: string | null;
  /** Foto de perfil del número (enlace temporal; si falla al cargar se muestra el ícono). */
  readonly profilePictureUrl: string | null;
  readonly lastConnectedAt: string | null;
  /** Cuántos disparadores tiene (activos y pausados). */
  readonly triggerCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateConnectionRequest {
  readonly name: string;
  readonly method: ConnectionMethod;
}

export interface UpdateConnectionRequest {
  readonly name: string;
}

/**
 * Estado de la vinculación de un número (al pedirla y al consultarla):
 *   qr            código para escanear (imagen PNG en data URL). El proveedor
 *                 lo renueva solo: quien lo muestra vuelve a consultar
 *   connected     ya quedó vinculado
 *   disconnected  la sesión se cerró (desde el celular o por WhatsApp)
 *   unavailable   este entorno todavía no puede vincular (proveedor sin configurar)
 */
export type ConnectionLinkState =
  | { readonly state: "qr"; readonly qrImage: string; readonly connection: ConnectionSummary }
  | { readonly state: "connected"; readonly connection: ConnectionSummary }
  | { readonly state: "disconnected"; readonly connection: ConnectionSummary }
  | { readonly state: "unavailable"; readonly reason: "provider_not_configured"; readonly message: string; readonly connection: ConnectionSummary };

/** Cada cuánto vuelve a consultar la pantalla mientras muestra el QR. */
export const LINK_POLL_INTERVAL_MS = 3_000;

/**
 * Cuánto dura el QR de WhatsApp (medido con uazapi el 2026-11-09): el primer
 * código ~60 s, después WhatsApp lo cambia cada ~20 s y a los ~2 min 45 s la
 * vinculación se cierra y hay que generar otra. La pantalla lo usa para la
 * cuenta atrás; quien manda es el estado que devuelve el proveedor.
 */
export const WHATSAPP_QR_TIMING = { firstCodeSeconds: 60, nextCodeSeconds: 20, sessionSeconds: 165 } as const;

export interface LinkConnectionRequest {
  /** Descartar el código actual y empezar con uno nuevo (reinicia el tiempo). */
  readonly restart?: boolean;
}
