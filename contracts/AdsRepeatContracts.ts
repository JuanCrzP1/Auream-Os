import type { AdLevel } from "./DashboardContracts";

// ---------------------------------------------------------------------------
// «Con recompras»: qué tan buenos son los clientes que trae cada anuncio.
//
//   Clientes nuevos  personas cuya PRIMERA compra (en Auream) vino de ese
//                    anuncio dentro del periodo elegido
//   Primera compra   lo que pagaron en esa primera compra
//   Recompras        todo lo que ESOS clientes compraron después, dentro de la
//                    ventana (30, 60 o 90 días desde su primera compra), venga
//                    o no de un anuncio
//   ROAS de nuevos   primera compra ÷ gasto del periodo
//   ROAS a N días    (primera compra + recompras) ÷ gasto del periodo
//
// Es una mirada aparte del ROAS real (que reparte cada venta al anuncio que la
// trajo): nunca se suman las dos. `GET /dashboard/ads/repeat?…&level&window`.
// ---------------------------------------------------------------------------

export const REPEAT_WINDOWS = [30, 60, 90] as const;
export type RepeatWindow = (typeof REPEAT_WINDOWS)[number];
export const DEFAULT_REPEAT_WINDOW: RepeatWindow = 60;

export interface AdRepeatMetrics {
  readonly spend: number;
  readonly newCustomers: number;
  readonly firstRevenue: number;
  /** Primera compra ÷ gasto; `null` sin gasto. */
  readonly newRoas: number | null;
  /** De los clientes nuevos, cuántos volvieron a comprar dentro de la ventana. */
  readonly repeatCustomers: number;
  readonly repeatRevenue: number;
  /** (Primera compra + recompras) ÷ gasto; `null` sin gasto. */
  readonly windowRoas: number | null;
}

export interface AdRepeatRow extends AdRepeatMetrics {
  readonly id: string;
  readonly name: string;
  readonly level: AdLevel;
  readonly status: string;
  readonly parentName: string | null;
  readonly thumbnailUrl: string | null;
  /** Mejora mucho con las recompras (su ROAS a N días supera en 25 % o más al de nuevos): no apagarlo solo por su primera venta. */
  readonly lifted: boolean;
}

export interface AdsRepeatResponse {
  readonly currency: string;
  readonly level: AdLevel;
  readonly window: RepeatWindow;
  readonly rows: ReadonlyArray<AdRepeatRow>;
  readonly totals: AdRepeatMetrics;
  /**
   * Días que faltan para que todos los clientes del periodo cumplan la ventana.
   * Mientras sea > 0, las recompras siguen creciendo («aún madurando»).
   */
  readonly maturingDays: number;
  readonly lastSyncedAt: string | null;
  readonly connected: boolean;
  /** La línea elegida no tiene campañas. */
  readonly lineWithoutCampaigns?: true;
}
