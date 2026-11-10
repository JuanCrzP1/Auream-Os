import type { SaleSource, SaleStatus } from "../../../contracts/SalesContracts";

// ---------------------------------------------------------------------------
// Venta: un pago real, con lo que se vendió, cuánto, en qué moneda y a quién.
//
// Regla central: SOLO las ventas completas (producto, monto y moneda) cuentan
// en los totales. Las incompletas quedan «Por revisar» con el motivo, hasta que
// alguien las corrija. Nunca se completa con un precio inventado.
// ---------------------------------------------------------------------------

export interface Sale {
  readonly id: string;
  readonly tenantId: string;
  readonly status: SaleStatus;
  readonly source: SaleSource;
  readonly productId: string | null;
  readonly productName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly contactId: string | null;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  /** Conexión de WhatsApp que vendió. */
  readonly connectionId: string | null;
  /** Automatización que la registró. */
  readonly flowKey: string | null;
  readonly adSourceId: string | null;
  readonly receiptReference: string | null;
  readonly reviewReason: string | null;
  readonly note: string;
  /** Quien la anotó o la revisó por última vez. */
  readonly recordedBy: string | null;
  readonly soldAt: string;
}

/** Una venta por guardar. `originKey` evita guardarla dos veces (mismo comprobante, mismo turno). */
export type NewSale = Omit<Sale, "id" | "status" | "reviewReason"> & { readonly originKey: string | null };

/** Lo que hace falta para que cuente. */
export type SaleCompleteness = Pick<Sale, "productId" | "amount" | "currency">;

/** Por qué no puede contar todavía; `null` si está completa. */
export function missingForApproval(sale: SaleCompleteness): string | null {
  const missing = [
    sale.productId ? null : "el producto",
    sale.amount !== null && sale.amount > 0 ? null : "el monto",
    sale.currency ? null : "la moneda"
  ].filter((item): item is string => item !== null);
  if (missing.length === 0) return null;
  const list = missing.length === 1 ? missing[0]! : `${missing.slice(0, -1).join(", ")} y ${missing[missing.length - 1]!}`;
  return `Falta ${list}.`;
}

/** El estado con que nace: aprobada si está completa; si no, «Por revisar» con el motivo (o el que ya traiga). */
export function initialStatus(sale: SaleCompleteness, reason: string | null = null): { status: SaleStatus; reviewReason: string | null } {
  const missing = missingForApproval(sale);
  if (missing || reason) return { status: "review", reviewReason: reason ?? missing };
  return { status: "approved", reviewReason: null };
}

/** Texto libre corto (nombres, notas, referencias): sin espacios de más y con tope. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

/** Un teléfono como lo guarda Auream: solo dígitos, entre 7 y 15. */
export function cleanPhone(value: unknown): string | null {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}
