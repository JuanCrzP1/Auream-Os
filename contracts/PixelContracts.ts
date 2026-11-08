// ---------------------------------------------------------------------------
// Píxeles de Meta — contratos compartidos por la API y el frontend.
//
// Una conexión de píxel es de la CUENTA: el ID del conjunto de datos (público)
// y su token de la API de Conversiones (secreto, cifrado). El token nunca
// vuelve al navegador: solo su pista. Los bloques Pixel guardan el id de la
// conexión, como en Leona (`pixel_config_id`).
// ---------------------------------------------------------------------------

/** ID de un píxel / conjunto de datos de Meta: solo dígitos. */
export const PIXEL_ID_PATTERN = /^\d{8,20}$/;

/** Dónde se crean el píxel y su token (Administrador de eventos → Configuración). */
export const META_EVENTS_MANAGER_URL = "https://business.facebook.com/events_manager2";

export type PixelConnectionStatus = "active" | "invalid";

export interface PixelConnectionSummary {
  readonly id: string;
  readonly name: string;
  readonly pixelId: string;
  /** Últimos caracteres del token: `••••ZDZD`. */
  readonly tokenHint: string;
  readonly status: PixelConnectionStatus;
  readonly lastVerifiedAt: string | null;
  readonly createdAt: string;
}

export interface CreatePixelConnectionRequest {
  readonly name: string;
  readonly pixelId: string;
  readonly accessToken: string;
}

/** Renombrar y/o reemplazar el token (se vuelve a verificar con Meta). */
export interface UpdatePixelConnectionRequest {
  readonly name?: string;
  readonly accessToken?: string;
}
