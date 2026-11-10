// ---------------------------------------------------------------------------
// Meta Ads (`/ads`): la conexión de la cuenta con Meta y sus cuentas
// publicitarias. Se conecta con el inicio de sesión de Meta (o pegando un
// token de usuario del sistema); el gasto se sincroniza solo.
// ---------------------------------------------------------------------------

export type MetaConnectionMethod = "oauth" | "token";

export interface MetaConnectionSummary {
  readonly connected: boolean;
  readonly method: MetaConnectionMethod | null;
  /** La persona de Meta que conectó. */
  readonly userName: string | null;
  /** Cuándo vence el permiso (`null`: no vence, como el token de un usuario del sistema). */
  readonly expiresAt: string | null;
  /** Vence en menos de 7 días o ya venció: hay que volver a conectar. */
  readonly needsReconnect: boolean;
  readonly lastError: string | null;
}

export interface AdAccountSummary {
  readonly id: string;
  /** `act_123…` en Meta. */
  readonly externalId: string;
  readonly name: string;
  readonly currency: string;
  readonly timezone: string;
  /** La cuenta está activa en Meta (no deshabilitada ni con pagos pendientes). */
  readonly active: boolean;
  /** Auream la sincroniza (la persona la eligió). */
  readonly enabled: boolean;
  readonly lastSyncedAt: string | null;
  readonly lastError: string | null;
}

export interface AdsAccountsResponse {
  readonly connection: MetaConnectionSummary;
  readonly accounts: ReadonlyArray<AdAccountSummary>;
  /** Conectar, elegir cuentas y desconectar (`ads.manage`). */
  readonly canManage: boolean;
  /** El servidor tiene la app de Meta configurada (si no, solo con token). */
  readonly oauthAvailable: boolean;
}

export interface MetaOAuthStartResponse {
  /** El inicio de sesión de Meta; al terminar vuelve a `/meta-ads?tab=accounts`. */
  readonly url: string;
}

export interface ConnectMetaTokenRequest {
  readonly accessToken: string;
}

export interface UpdateAdAccountRequest {
  readonly enabled: boolean;
}

/** Cada cuánto se sincroniza solo y desde cuándo trae la primera vez. */
export const ADS_SYNC_EVERY_HOURS = 3;
export const ADS_FIRST_SYNC_DAYS = 62;
