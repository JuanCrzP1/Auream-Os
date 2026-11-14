import type { Trend } from "./DashboardContracts";

// ---------------------------------------------------------------------------
// Comparar líneas (`GET /dashboard/lines`): una fila por línea de venta, en el
// mismo periodo y la misma moneda, para ver qué parte del negocio deja plata y
// cuál la quema. Al final, todo el negocio. Los filtros que acepta son el
// periodo (`from`/`to`) y la moneda (`currency`); las líneas mandan en lo demás.
// ---------------------------------------------------------------------------

export interface LineComparisonRow {
  /** `null` = todo el negocio. */
  readonly id: string | null;
  readonly name: string;
  readonly color: string | null;
  /** Todo lo vendido (ventas aprobadas). */
  readonly revenue: Trend;
  readonly sales: number;
  readonly averageTicket: number | null;
  /** Qué parte de la facturación del negocio es (0–1). `null` sin ventas en el negocio. */
  readonly share: number | null;
  /** La línea tiene campañas de Meta (sin ellas no se sabe su gasto). */
  readonly hasCampaigns: boolean;
  /** Gasto en Meta de sus campañas. `null` sin campañas o sin `ads.read`. */
  readonly spend: number | null;
  /** Lo vendido por sus anuncios ÷ su gasto. `null` sin gasto. */
  readonly roas: number | null;
  /** Lo que Meta reporta en compras ÷ su gasto. `null` sin gasto o sin `ads.read`. */
  readonly roasMeta: number | null;
  /** Otros gastos de la línea (o de todo, en la fila del negocio). `null` sin `ads.read`. */
  readonly otherSpend: number | null;
  /**
   * Facturación − gasto en Meta − otros gastos − costo de los productos (si
   * todos lo tienen). `null` sin `ads.read` (con la facturación delataría el gasto)
   * o si sus ventas de anuncios no se conocen (`salesUnknown`).
   */
  readonly profit: Trend | null;
  /** Ganancia ÷ facturación. */
  readonly margin: number | null;
  /** Gasta en Meta y en Auream no hay ninguna venta de sus anuncios: ROAS real, ganancia y margen no se conocen (no son 0); se muestra el ROAS de Meta. */
  readonly salesUnknown?: true;
}

export interface LineComparisonResponse {
  readonly currency: string;
  readonly missingRates: ReadonlyArray<string>;
  readonly canSeeAds: boolean;
  /** De la que más gana a la que menos (sin `ads.read`, la que más factura). */
  readonly rows: ReadonlyArray<LineComparisonRow>;
  readonly total: LineComparisonRow;
  /**
   * Las líneas se pisan (comparten ventas o campañas): su suma pasa del total
   * del negocio. Pasa, por ejemplo, si un producto está en dos líneas.
   */
  readonly overlapping: boolean;
}
