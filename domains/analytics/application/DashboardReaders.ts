import type { AdLevel, RecentSale } from "../../../contracts/DashboardContracts";
import type { Period } from "./DashboardPeriod";

// ---------------------------------------------------------------------------
// Lo que el Dashboard lee (solo lee) de Ventas, Meta Ads y Conversaciones.
// Implementación: `infrastructure/persistence/sql/SqlDashboard*.ts`. Los
// montos llegan en su moneda; convertirlos es cosa del servicio.
// ---------------------------------------------------------------------------

export interface DashboardScope {
  readonly connectionId?: string;
  readonly productId?: string;
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
  /** Chats nuevos del periodo (y cuántos llegaron por anuncio). */
  leads(tenantId: string, period: Period, scope: DashboardScope): Promise<{ total: number; fromAds: number }>;
  reviewCount(tenantId: string): Promise<number>;
  recent(tenantId: string, scope: DashboardScope, limit: number): Promise<ReadonlyArray<RecentSale>>;
}

/** Lo que reportó Meta en un día, en la moneda de la cuenta. */
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
  status(tenantId: string): Promise<{ accounts: number; lastSyncedAt: string | null; mainCurrency: string | null; activeCampaigns: number }>;
  spend(tenantId: string, period: Period): Promise<ReadonlyArray<SpendDay>>;
  entityDays(tenantId: string, period: Period, level: AdLevel): Promise<ReadonlyArray<EntityDay>>;
  entities(tenantId: string, level: AdLevel, ids: ReadonlyArray<string>): Promise<ReadonlyArray<EntityInfo>>;
  attributed(tenantId: string, period: Period, level: AdLevel, timezone: string): Promise<ReadonlyArray<AttributedDay>>;
}
