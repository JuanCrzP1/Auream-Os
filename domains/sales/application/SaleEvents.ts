// ---------------------------------------------------------------------------
// SaleEvents — Ventas avisa cuando una venta queda aprobada (entra completa o
// alguien la aprueba). Hoy escucha el CRM: quien compra pasa a la etapa de
// compra con el valor real. Ventas no sabe quién escucha; la composición lo
// conecta. Quien escucha no debe lanzar.
// ---------------------------------------------------------------------------

export interface ApprovedSaleEvent {
  /** La venta (el CRM la une a la compra que cerró y no la cuenta dos veces). */
  readonly id: string;
  readonly contactId: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly productId: string | null;
  readonly productName: string | null;
}

export interface SaleEvents {
  saleApproved(tenantId: string, sale: ApprovedSaleEvent): Promise<void>;
}

export const NO_SALE_EVENTS: SaleEvents = { saleApproved: async () => {} };

/** Lo que se cuenta de una venta aprobada. */
export function approvedEventOf(sale: ApprovedSaleEvent): ApprovedSaleEvent {
  return { id: sale.id, contactId: sale.contactId, amount: sale.amount, currency: sale.currency, productId: sale.productId, productName: sale.productName };
}
