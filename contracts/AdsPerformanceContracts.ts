import type { AdMeasurement } from "./AdMeasurementContracts";

// ---------------------------------------------------------------------------
// Dashboard › Anuncios y Meta Ads › Rendimiento: cada campaña, conjunto o
// anuncio con lo que gastó (Meta), lo que vendió de verdad (Auream) y qué
// hacer con él. Se importa desde `DashboardContracts`.
// ---------------------------------------------------------------------------

export const AD_LEVELS = ["campaign", "adset", "ad"] as const;
export type AdLevel = (typeof AD_LEVELS)[number];

/**
 * Qué hacer con una campaña, conjunto o anuncio. Los tres últimos no son un
 * veredicto: Auream no ve lo suficiente para darlo (`AdMeasurementContracts`).
 */
export type AdAdvice = "scale" | "keep" | "review" | "pause" | "learning" | "unmeasured" | "partial" | "unsold";

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
  /** Chats que cobró Meta. */
  readonly chats: number;
  /** De esos, los clientes que llegaron a Auream por el anuncio. */
  readonly arrivedChats: number;
  readonly sales: number;
  readonly metaPurchases: number;
  readonly revenue: number;
  readonly metaRevenue: number;
  /** `null` (como `roas`): Auream no ve las ventas, así que no se conoce. */
  readonly profit: number | null;
  readonly roas: number | null;
  readonly roasMeta: number | null;
  readonly costPerChat: number | null;
  /** Gasto ÷ ventas reales (las anotadas en Auream). */
  readonly costPerSale: number | null;
  /** Gasto ÷ compras que reporta Meta: su «Coste por resultado» de compras. */
  readonly costPerSaleMeta: number | null;
  readonly ctr: number | null;
  readonly advice: AdAdvice;
  readonly adviceReason: string;
}

export interface AdsDashboardResponse {
  readonly currency: string;
  readonly level: AdLevel;
  readonly rows: ReadonlyArray<AdPerformanceRow>;
  readonly totals: Omit<AdPerformanceRow, "id" | "name" | "level" | "status" | "parentName" | "dailyBudget" | "thumbnailUrl" | "advice" | "adviceReason">;
  /** Cuánto ve Auream de lo que venden estos anuncios, en conjunto. */
  readonly measurement: AdMeasurement;
  /** Ventas por anuncio que Meta no vio (las nuestras − las del Píxel). */
  readonly unseenSales: number;
  /** De las ventas por anuncio, qué parte compró después del primer día de chat (0 a 1). */
  readonly lateShare: number | null;
  readonly lastSyncedAt: string | null;
  readonly connected: boolean;
  /** La línea elegida no tiene campañas: no hay anuncios que mostrar (no son los de todo el negocio). */
  readonly lineWithoutCampaigns?: true;
}
