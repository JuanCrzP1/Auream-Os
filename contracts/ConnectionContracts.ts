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
  readonly lastConnectedAt: string | null;
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
