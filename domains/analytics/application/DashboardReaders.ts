import type { AdLevel, RecentSale } from "../../../contracts/DashboardContracts";
import type { Period } from "./DashboardPeriod";

// ---------------------------------------------------------------------------
// Lo que el Dashboard lee (solo lee) de Ventas, Meta Ads y Conversaciones.
// Implementación: `infrastructure/persistence/sql/SqlDashboard*.ts`. Los
// montos llegan en su moneda; convertirlos es cosa del servicio.
// ---------------------------------------------------------------------------

/**
 * Qué parte del negocio se mira. Cada lista vacía o ausente = todo. Números y
 * productos recortan las ventas; las campañas recortan el gasto y las ventas
 * que trajeron los anuncios (las orgánicas siguen contando).
 */
export interface DashboardScope {
  readonly connectionIds?: ReadonlyArray<string>;
  readonly productIds?: ReadonlyArray<string>;
  readonly campaignIds?: ReadonlyArray<string>;
}

/** Ventas aprobadas de un día en una moneda; `ad*` = las que llegaron por un anuncio. */
export interface SalesDay {
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
  readonly adAmount: number;
  readonly adCount: number;
  /** Costo de los productos vendidos (los que tienen costo). */
  readonly cost: number;
  /** Ventas cuyo producto no tiene costo en ese país. */
  readonly withoutCost: number;
}

export interface BreakdownRow {
  readonly key: string;
  readonly label: string;
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
}

export interface SalesReader {
  days(tenantId: string, period: Period, scope: DashboardScope, timezone: string): Promise<ReadonlyArray<SalesDay>>;
  byHour(tenantId: string, period: Period, scope: DashboardScope, timezone: string): Promise<ReadonlyArray<number>>;
  breakdown(tenantId: string, period: Period, scope: DashboardScope, timezone: string, by: "connection" | "product" | "country"): Promise<ReadonlyArray<BreakdownRow>>;
  /**
   * Chats nuevos del periodo, cuántos llegaron por anuncio y cuántos de ellos
   * compraron en el periodo (venta aprobada del mismo cliente; una venta a
   * mano cuenta por su teléfono).
   */
  leads(tenantId: string, period: Period, scope: DashboardScope): Promise<LeadCounts>;
  reviewCount(tenantId: string): Promise<number>;
  recent(tenantId: string, scope: DashboardScope, limit: number): Promise<ReadonlyArray<RecentSale>>;
}

/** Lo que reportó Meta en un día, en la moneda de la cuenta. */
export interface LeadCounts {
  readonly total: number;
  readonly fromAds: number;
  readonly converted: number;
}

export interface SpendDay {
  readonly day: string;
  readonly currency: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversations: number;
  readonly metaPurchases: number;
  readonly metaRevenue: number;
}

/** Una campaña, conjunto o anuncio con lo que reportó Meta en el periodo (por día y moneda). */
export interface EntityDay extends SpendDay {
  readonly id: string;
}

export interface EntityInfo {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly parentName: string | null;
  readonly dailyBudget: number | null;
  readonly thumbnailUrl: string | null;
}

/** Ventas atribuidas a una campaña, conjunto o anuncio, por día y moneda. */
export interface AttributedDay {
  readonly id: string;
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
  /** De esas, cuántas compraron después del primer día de chat. */
  readonly late: number;
}

export interface AdsReader {
  /** ¿Hay cuentas elegidas? Y su última sincronización y la moneda con más gasto. */
  /** `activeCampaigns`: de las campañas elegidas en `scope`, si las hay. */
  status(tenantId: string, scope?: DashboardScope): Promise<{ accounts: number; lastSyncedAt: string | null; mainCurrency: string | null; activeCampaigns: number }>;
  /** El gasto (solo de las campañas de `scope`, si las hay). */
  spend(tenantId: string, period: Period, scope?: DashboardScope): Promise<ReadonlyArray<SpendDay>>;
  entityDays(tenantId: string, period: Period, level: AdLevel, scope?: DashboardScope): Promise<ReadonlyArray<EntityDay>>;
  entities(tenantId: string, level: AdLevel, ids: ReadonlyArray<string>): Promise<ReadonlyArray<EntityInfo>>;
  /** Ventas por anuncio: de las campañas de `scope` y de sus números y productos, si los hay. */
  attributed(tenantId: string, period: Period, level: AdLevel, timezone: string, scope?: DashboardScope): Promise<ReadonlyArray<AttributedDay>>;
}
