// ---------------------------------------------------------------------------
// SaleEvents — Ventas avisa cuando una venta queda aprobada (entra completa o
// alguien la aprueba): el CRM pasa a quien compra a la etapa de compra con el
// valor real. Y cuando una venta NUEVA queda «Por revisar»: el aviso al
// celular de quien revisa ventas. Ventas no sabe quién escucha; la composición
// lo conecta. Quien escucha no debe lanzar.
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

/** Una venta nueva que hay que revisar (falta algo o el comprobante no cuadra). */
export interface ReviewSaleEvent {
  readonly id: string;
  readonly customerName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly reviewReason: string | null;
  /** Quién la anotó a mano (`null`: la registró un flujo). */
  readonly recordedBy: string | null;
}

export interface SaleEvents {
  saleApproved(tenantId: string, sale: ApprovedSaleEvent): Promise<void>;
  /** Opcional: quien no lo escucha no lo implementa. */
  saleNeedsReview?(tenantId: string, sale: ReviewSaleEvent): Promise<void>;
}

export const NO_SALE_EVENTS: SaleEvents = { saleApproved: async () => {} };

/** Lo que se cuenta de una venta aprobada. */
export function approvedEventOf(sale: ApprovedSaleEvent): ApprovedSaleEvent {
  return { id: sale.id, contactId: sale.contactId, amount: sale.amount, currency: sale.currency, productId: sale.productId, productName: sale.productName };
}

/** Lo que se cuenta de una venta por revisar. */
export function reviewEventOf(sale: ReviewSaleEvent): ReviewSaleEvent {
  return { id: sale.id, customerName: sale.customerName, amount: sale.amount, currency: sale.currency, reviewReason: sale.reviewReason, recordedBy: sale.recordedBy };
}
