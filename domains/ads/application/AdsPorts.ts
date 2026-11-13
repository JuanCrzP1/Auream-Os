import type { AdAccount, AdDailyInsight, AdEntity, MetaConnection, ProviderAdAccount } from "../domain/AdAccount";

// ---------------------------------------------------------------------------
// Puertos de Meta Ads. El proveedor (`infrastructure/meta/MetaMarketingClient`)
// habla con la Marketing API; el repositorio guarda en PostgreSQL. Otro
// proveedor (TikTok, Google) sería otro adaptador del mismo puerto.
// ---------------------------------------------------------------------------

/** Un fallo de Meta ya explicado en español. `reconnect`: el token ya no sirve. */
/**
 * Un error de Meta, ya en español. `reconnect`: hace falta otro permiso.
 * `reason`: el token no sirve (mal copiado, vencido o revocado) o le falta el
 * permiso de leer anuncios; quien conecta con un token recibe instrucciones
 * concretas para arreglarlo.
 */
export class AdsProviderError extends Error {
  public constructor(
    message: string,
    public readonly reconnect = false,
    public readonly reason: "token" | "permission" | null = null
  ) {
    super(message);
  }
}

export interface ProviderUser {
  readonly id: string;
  readonly name: string;
}

export interface AdsProvider {
  /** El inicio de sesión de Meta (`null` si el servidor no tiene la app configurada). */
  authorizeUrl(state: string, redirectUri: string): string | null;
  /** Cambia el código del inicio de sesión por un token de larga duración. */
  exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: string | null }>;
  me(token: string): Promise<ProviderUser>;
  /** Cuándo vence el token (`null`: no vence) — para un token pegado. */
  tokenExpiry(token: string): Promise<string | null>;
  listAccounts(token: string): Promise<ReadonlyArray<ProviderAdAccount>>;
  entities(token: string, accountExternalId: string): Promise<ReadonlyArray<AdEntity>>;
  /** Por anuncio y por día, entre esas fechas (incluidas, `YYYY-MM-DD`). */
  insights(token: string, accountExternalId: string, since: string, until: string): Promise<ReadonlyArray<AdDailyInsight>>;
}

export interface AdsRepository {
  connection(tenantId: string): Promise<MetaConnection | null>;
  saveConnection(connection: MetaConnection): Promise<void>;
  setConnectionError(tenantId: string, error: string | null): Promise<void>;
  /** Borra la conexión y sus cuentas (con su gasto). */
  removeConnection(tenantId: string): Promise<void>;
  accounts(tenantId: string): Promise<ReadonlyArray<AdAccount>>;
  account(tenantId: string, accountId: string): Promise<AdAccount | null>;
  /** Agrega o actualiza las cuentas que ve el token (las que ya estaban conservan si están elegidas). */
  upsertAccounts(tenantId: string, accounts: ReadonlyArray<ProviderAdAccount>): Promise<void>;
  setEnabled(tenantId: string, accountId: string, enabled: boolean): Promise<AdAccount | null>;
  markSynced(tenantId: string, accountId: string, error: string | null): Promise<void>;
  saveEntities(tenantId: string, accountId: string, entities: ReadonlyArray<AdEntity>): Promise<void>;
  /** Reemplaza lo de esos días (Meta corrige los últimos días). */
  saveInsights(tenantId: string, accountId: string, since: string, until: string, insights: ReadonlyArray<AdDailyInsight>): Promise<void>;
}

/** El cifrado de secretos de la plataforma. */
export interface TokenCipher {
  encrypt(plaintext: string, context: string): string;
  decrypt(envelope: string, context: string): string;
}

/** Programar la próxima sincronización (cola de tareas). */
export interface AdsSyncScheduler {
  scheduleSync(tenantId: string, accountId: string, at: Date, window?: { since: string; until: string }): Promise<void>;
}
