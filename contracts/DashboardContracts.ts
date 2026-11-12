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
  /** Un solo número (como antes). `connectionIds` gana si llegan los dos. */
  readonly connectionId?: string;
  /** Un solo producto (como antes). `productIds` gana si llegan los dos. */
  readonly productId?: string;
  /** Varios números; vacío o ausente = todos. */
  readonly connectionIds?: ReadonlyArray<string>;
  /** Varios productos; vacío o ausente = todos. */
  readonly productIds?: ReadonlyArray<string>;
  /** Campañas de Meta (su gasto y las ventas que trajeron); vacío o ausente = todas. */
  readonly campaignIds?: ReadonlyArray<string>;
  /** Una línea de venta: lo que no se filtre a mano sale de ella. */
  readonly lineId?: string;
  /** Moneda en que se muestran los montos (ISO). Ausente: la de la cuenta de anuncios o la más vendida. */
  readonly currency?: string;
}

/** Las tasas de cambio oficiales más recientes (`GET /dashboard/fx`). */
export interface FxRatesResponse {
  /** Día de las tasas (`YYYY-MM-DD`); `null` si aún no hay ninguna. */
  readonly day: string | null;
  /** Cuándo llegaron. */
  readonly updatedAt: string | null;
  /** Unidades de cada moneda por 1 USD y de qué fuente oficial vino («bcv», «open-er-api»). */
  readonly rates: ReadonlyArray<{ readonly currency: string; readonly perUsd: number; readonly source: string | null }>;
}

/** Un número del periodo, el del periodo anterior del mismo largo y su cambio (0.18 = +18 %). */
export interface Trend {
  readonly value: number;
  readonly previous: number;
  readonly change: number | null;
}

/** Un gasto fuera de Meta y cuánto costó en el periodo (en la moneda de reporte). */
export interface OtherExpenseCharge {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
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
  /** De los leads nuevos del periodo, la parte que compró en el periodo (0 a 1; nunca más de 1). */
  readonly conversion: number | null;
  /** La misma conversión en el periodo anterior (para su cambio). */
  readonly conversionPrevious: number | null;
  /** Leads nuevos del periodo que ya compraron. */
  readonly convertedLeads: number;
  readonly reviewCount: number;
  /** `null`: sin Meta conectado o sin permiso para ver el gasto. */
  readonly ads: AdsMoneySummary | null;
  /** Ganancia real (ventas − anuncios − otros gastos − costo de productos); `null` si no hay costos. */
  readonly realProfit: number | null;
  /**
   * Ganancia del periodo: facturación − inversión en Meta − otros gastos (− costo de
   * productos si el catálogo lo tiene), frente al periodo anterior. `null`
   * para quien no puede ver el gasto (se deduciría de la resta).
   */
  readonly profit: Trend | null;
  /**
   * Otros gastos (los que no son Meta: nómina, pasarela, herramientas…) en
   * el periodo y el anterior. `null` sin gastos para lo que se mira o sin
   * permiso para ver el gasto. Ya están restados de `profit` y `realProfit`.
   */
  readonly otherSpend: Trend | null;
  /** Cuánto costó cada uno en el periodo (vacío si `otherSpend` es `null`). */
  readonly otherExpenses: ReadonlyArray<OtherExpenseCharge>;
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
  /** Puede descargar las ventas (`GET /dashboard/sales/export`, con `sales.manage`): traen los teléfonos de los clientes. */
  readonly canExport: boolean;
}

/** Tope de filas de «Descargar ventas» (que la descarga nunca se caiga). */
export const SALES_EXPORT_MAX_ROWS = 20_000;

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
