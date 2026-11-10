import type { AdLevel } from "../../../contracts/DashboardContracts";
import type { MetaConnectionMethod } from "../../../contracts/AdsContracts";

// ---------------------------------------------------------------------------
// Lo que Auream guarda de Meta Ads: la conexión (con su token cifrado), las
// cuentas publicitarias, sus campañas, conjuntos y anuncios, y lo que reporta
// Meta por anuncio y por día (en la moneda de la cuenta).
// ---------------------------------------------------------------------------

export interface MetaConnection {
  readonly tenantId: string;
  readonly method: MetaConnectionMethod;
  readonly tokenCiphertext: string;
  readonly metaUserId: string | null;
  readonly metaUserName: string | null;
  readonly connectedBy: string | null;
  readonly expiresAt: string | null;
  readonly lastError: string | null;
}

export interface AdAccount {
  readonly id: string;
  readonly tenantId: string;
  readonly externalId: string;
  readonly name: string;
  readonly currency: string;
  readonly timezone: string;
  /** 1 = activa en Meta (https://developers.facebook.com/docs/marketing-api/reference/ad-account). */
  readonly providerStatus: number | null;
  readonly enabled: boolean;
  readonly lastSyncedAt: string | null;
  readonly lastError: string | null;
}

/** Una cuenta como la devuelve Meta (antes de guardarla). */
export interface ProviderAdAccount {
  readonly externalId: string;
  readonly name: string;
  readonly currency: string;
  readonly timezone: string;
  readonly providerStatus: number | null;
}

/** Campaña, conjunto o anuncio. */
export interface AdEntity {
  readonly level: AdLevel;
  readonly externalId: string;
  /** El conjunto de un anuncio, la campaña de un conjunto. */
  readonly parentId: string | null;
  readonly campaignId: string | null;
  readonly name: string;
  readonly status: string;
  readonly dailyBudget: number | null;
  readonly thumbnailUrl: string | null;
}

/** Lo que Meta reporta de un anuncio en un día. */
export interface AdDailyInsight {
  readonly adId: string;
  readonly day: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  /** Conversaciones de mensajería iniciadas (clic a WhatsApp). */
  readonly conversations: number;
  /** Compras que vio el Píxel y su valor (lo que «cree» Meta). */
  readonly metaPurchases: number;
  readonly metaRevenue: number;
}

/** El token vence en menos de una semana (o ya venció): hay que reconectar. */
export function needsReconnect(expiresAt: string | null, now: Date): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() - now.getTime() < 7 * 86_400_000;
}

/** El estado 1 de Meta es «activa»; los demás (2 deshabilitada, 3 sin pagar…) no gastan. */
export const isActiveAccount = (status: number | null) => status === 1;
