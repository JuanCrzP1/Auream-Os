import type { AdMeasurement, AdMeasurementState } from "../../../contracts/AdMeasurementContracts";

// ---------------------------------------------------------------------------
// ¿Auream ve lo que vende este anuncio? La misma regla para una campaña, un
// conjunto, un anuncio o la cuenta entera (ver `AdMeasurementContracts`).
// Se decide con lo que cobró Meta frente a lo que llegó a Auream: nunca con
// las ventas de Meta, que solo sirven para avisar que algo no se anota.
// ---------------------------------------------------------------------------

export interface MeasurementInput {
  /** Chats que cobró Meta. */
  readonly metaChats: number;
  /** Clientes que llegaron a Auream por el anuncio. */
  readonly arrivedChats: number;
  /** Ventas anotadas en Auream de clientes que llegaron por el anuncio. */
  readonly sales: number;
  /** Compras que reporta Meta. */
  readonly metaPurchases: number;
  /** El negocio anota ventas en Auream (hay alguna aprobada reciente). */
  readonly recordsSales: boolean;
}

/** Desde cuántos chats de Meta, que no llegue ninguno ya no es casualidad. */
export const NONE_MIN_CHATS = 5;
/** Con menos chats, la proporción que llegó salta demasiado para fiarse. */
export const PARTIAL_MIN_CHATS = 10;
/** De los chats que cobró Meta, la parte mínima que debe llegar para juzgar. */
export const MIN_COVERAGE = 0.5;
/** Compras que Meta cuenta y Auream no: desde aquí se avisa que no se anotan. */
export const META_SALES_GAP = 3;
/** Una venta aprobada en estos días prueba que el negocio las anota en Auream. */
export const SALES_PROOF_DAYS = 30;

export function measurementStateOf(input: MeasurementInput): AdMeasurementState {
  if (input.metaChats >= NONE_MIN_CHATS && input.arrivedChats === 0 && input.sales === 0) return "none";
  if (input.metaChats >= PARTIAL_MIN_CHATS && input.arrivedChats < input.metaChats * MIN_COVERAGE) return "partial";
  if (input.sales === 0 && (!input.recordsSales || input.metaPurchases >= META_SALES_GAP)) return "unsold";
  return "measured";
}

export function measurementOf(input: MeasurementInput): AdMeasurement {
  return { state: measurementStateOf(input), metaChats: input.metaChats, arrivedChats: input.arrivedChats, metaPurchases: input.metaPurchases };
}

/** Sin anuncios que mirar no hay nada que medir (ni nada que avisar). */
export const NOTHING_TO_MEASURE: AdMeasurement = { state: "measured", metaChats: 0, arrivedChats: 0, metaPurchases: 0 };

/** Desde cuándo se busca una venta que pruebe que el negocio las anota: el periodo o los últimos días, lo que abarque más. */
export function salesProofSince(period: { readonly from: Date; readonly until: Date }): Date {
  const recent = new Date(period.until.getTime() - SALES_PROOF_DAYS * 86_400_000);
  return recent < period.from ? recent : period.from;
}
