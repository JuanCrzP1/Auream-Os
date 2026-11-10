import type { RecordSaleAmountMode } from "../../contracts/RecordSaleConfig";

// ---------------------------------------------------------------------------
// SalesLedger — lo que el bloque «Registrar venta» necesita para guardar una
// venta en Ventas.
//
//   RecordSaleNodeHandler → SalesLedger (este puerto) → domains/sales
//
// El motor NO conoce el dominio de ventas ni el catálogo: entrega los textos ya
// resueltos (variables reemplazadas) y el dominio decide producto, monto,
// moneda, país y si la venta cuenta o queda «Por revisar». La simulación del
// builder usa una implementación que calcula la venta SIN guardarla.
// ---------------------------------------------------------------------------

export interface FlowSaleRequest {
  readonly productId: string;
  readonly amountMode: RecordSaleAmountMode;
  /** Monto ya resuelto («150000», «$150.000»…). Vacío si la variable no tenía valor. */
  readonly amount: string;
  /** Moneda ya resuelta («COP»). */
  readonly currency: string;
  readonly customerName: string;
  readonly reference: string;
  readonly contactId: string | null;
  readonly contactName: string | null;
  readonly customerPhone: string | null;
  readonly connectionId: string | null;
  readonly flowKey: string;
  readonly adSourceId: string | null;
  /** Instante de la ejecución (ISO 8601). */
  readonly soldAt: string;
  /** Identidad de este paso (bloque + mensaje): un reintento no duplica la venta. */
  readonly stepKey: string;
}

export interface FlowSaleOutcome {
  /** Nula en la simulación (no se guarda). */
  readonly id: string | null;
  readonly status: "approved" | "review";
  readonly productName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly reviewReason: string | null;
  /** Ya estaba guardada (mismo comprobante o reintento): no se duplicó. */
  readonly duplicate: boolean;
  /** `false` en la simulación. */
  readonly saved: boolean;
}

export type FlowSaleResult =
  | { readonly ok: true; readonly sale: FlowSaleOutcome }
  | { readonly ok: false; readonly reason: "unavailable" | "error"; readonly message: string };

export interface SalesLedger {
  record(tenantId: string, request: FlowSaleRequest): Promise<FlowSaleResult>;
}
