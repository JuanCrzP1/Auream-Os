// ---------------------------------------------------------------------------
// Dashboard (`/dashboard`): Ventas · Anuncios · Atención. Todo lo que es
// dinero va en UNA moneda de reporte (la de la cuenta publicitaria con más
// gasto, o la de la mayoría de las ventas): lo de otras monedas se convierte
// al cambio del día. El gasto y la ganancia solo los ve quien tiene `ads.read`.
// ---------------------------------------------------------------------------

/** `from`/`to` en `YYYY-MM-DD`, días de la empresa (como en Ventas). */
export interface DashboardFilters {
  readonly from?: string;
  readonly to?: string;
  readonly connectionId?: string;
  readonly productId?: string;
}

/** Un número del periodo, el del periodo anterior del mismo largo y su cambio (0.18 = +18 %). */
export interface Trend {
  readonly value: number;
  readonly previous: number;
  readonly change: number | null;
}

export interface AdsMoneySummary {
  readonly spend: Trend;
  /** Ventas atribuidas a anuncios (las que llegaron con el anuncio del chat). */
  readonly revenue: Trend;
  /** Ventas atribuidas − gasto. */
  readonly profit: Trend;
  /** Además restando el costo de los productos (si el catálogo lo tiene). */
  readonly realProfit: number | null;
  readonly roas: number | null;
  /** Lo que Meta cree (sus compras del Píxel): suele ser menos. */
  readonly roasMeta: number | null;
  readonly costPerSale: number | null;
  readonly costPerChat: number | null;
  readonly revenuePerChat: number | null;
  readonly chats: number;
  readonly attributedSales: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly activeCampaigns: number;
}

export interface DayPoint {
  readonly day: string;
  readonly revenue: number;
  readonly spend: number;
}

export interface Breakdown {
  readonly key: string;
  readonly label: string;
  readonly revenue: number;
  readonly sales: number;
  readonly roas?: number | null;
}

export interface RecentSale {
  readonly id: string;
  readonly customerName: string | null;
  readonly productName: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly adName: string | null;
  readonly connectionName: string | null;
  readonly soldAt: string;
}

export interface SalesDashboardResponse {
  readonly currency: string;
  /** Monedas sin cambio conocido: sus ventas no entran en lo convertido. */
  readonly missingRates: ReadonlyArray<string>;
  readonly revenue: Trend;
  readonly sales: Trend;
  readonly averageTicket: number | null;
  readonly leads: Trend;
  readonly leadsFromAds: number;
  /** Ventas ÷ leads nuevos (0 a 1). */
  readonly conversion: number | null;
  readonly reviewCount: number;
  /** `null`: sin Meta conectado o sin permiso para ver el gasto. */
  readonly ads: AdsMoneySummary | null;
  /** Ganancia real (ventas − anuncios − costo de productos); `null` si no hay costos. */
  readonly realProfit: number | null;
  readonly costsKnown: boolean;
  readonly daily: ReadonlyArray<DayPoint>;
  /** Del anuncio a la venta; `null` sin Meta. */
  readonly funnel: { readonly impressions: number; readonly clicks: number; readonly chats: number; readonly sales: number } | null;
  /** Ventas por hora del día (24, en la hora de la empresa). */
  readonly byHour: ReadonlyArray<number>;
  readonly byConnection: ReadonlyArray<Breakdown>;
  readonly byProduct: ReadonlyArray<Breakdown>;
  readonly byCountry: ReadonlyArray<Breakdown>;
  readonly recentSales: ReadonlyArray<RecentSale>;
  readonly canSeeAds: boolean;
}

export const AD_LEVELS = ["campaign", "adset", "ad"] as const;
export type AdLevel = (typeof AD_LEVELS)[number];

/** Qué hacer con una campaña, conjunto o anuncio. */
export type AdAdvice = "scale" | "keep" | "review" | "pause" | "learning";

export interface AdPerformanceRow {
  readonly id: string;
  readonly name: string;
  readonly level: AdLevel;
  readonly status: string;
  readonly parentName: string | null;
  readonly dailyBudget: number | null;
  readonly thumbnailUrl: string | null;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly chats: number;
  readonly sales: number;
  readonly metaPurchases: number;
  readonly revenue: number;
  readonly metaRevenue: number;
  readonly profit: number;
  readonly roas: number | null;
  readonly roasMeta: number | null;
  readonly costPerChat: number | null;
  readonly costPerSale: number | null;
  readonly ctr: number | null;
  readonly advice: AdAdvice;
  readonly adviceReason: string;
}

export interface AdsDashboardResponse {
  readonly currency: string;
  readonly level: AdLevel;
  readonly rows: ReadonlyArray<AdPerformanceRow>;
  readonly totals: Omit<AdPerformanceRow, "id" | "name" | "level" | "status" | "parentName" | "dailyBudget" | "thumbnailUrl" | "advice" | "adviceReason">;
  /** Ventas por anuncio que Meta no vio (las nuestras − las del Píxel). */
  readonly unseenSales: number;
  /** De las ventas por anuncio, qué parte compró después del primer día de chat (0 a 1). */
  readonly lateShare: number | null;
  readonly lastSyncedAt: string | null;
  readonly connected: boolean;
}
