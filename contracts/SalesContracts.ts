// ---------------------------------------------------------------------------
// Ventas y Productos — lo que cruza entre la API y la web (`/products`, `/sales`).
//
// Producto: lo que vende la cuenta, con su precio en cada país donde lo vende.
// Venta: cada pago real. Se registra sola cuando el bloque Comprobante aprueba
// un pago, la anota un asesor o llega por un webhook. Si le falta el producto
// o el monto queda «Por revisar» y NO cuenta en los totales hasta corregirla.
// ---------------------------------------------------------------------------

/** Principal (lo que se anuncia), upsell (se ofrece después de comprar) o downsell (si no compra el principal). */
export const PRODUCT_KINDS = ["main", "upsell", "downsell"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Activo (se vende y se elige en los flujos) o archivado (ya no se vende; sus ventas se conservan). */
export const PRODUCT_STATUSES = ["active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** El precio en un país, en su moneda. */
export interface ProductPrice {
  /** ISO 3166-1 alfa-2 (`CO`, `MX`…), de `contracts/Countries.ts`. */
  readonly country: string;
  /** ISO 4217. Por defecto la del país; puede ser otra (USD en Venezuela). */
  readonly currency: string;
  readonly amount: number;
  /** Lo que le cuesta al negocio (en la misma moneda), para la ganancia real; `null` si no se sabe. */
  readonly cost?: number | null;
}

export interface ProductSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly prices: ReadonlyArray<ProductPrice>;
  /** Ventas aprobadas de este producto (todas las fechas). */
  readonly salesCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductListResponse {
  readonly products: ReadonlyArray<ProductSummary>;
  /** Quien mira puede crear, editar y archivar (`sales.manage`). */
  readonly canManage: boolean;
  /** Quien mira puede anotar ventas con este catálogo (`sales.write`), p. ej. desde un chat. */
  readonly canRecordSales: boolean;
}

/** Un precio como lo manda el editor: el monto puede venir como lo escribe la persona («49.900»). */
export interface ProductPriceInput {
  readonly country: string;
  /** Vacío: la moneda del país. */
  readonly currency?: string;
  readonly amount: number | string;
  /** Opcional: lo que le cuesta al negocio (vacío o `null`: no se sabe). */
  readonly cost?: number | string | null;
}

export interface SaveProductRequest {
  readonly name: string;
  readonly description?: string;
  readonly kind: ProductKind;
  readonly status?: ProductStatus;
  readonly prices: ReadonlyArray<ProductPriceInput>;
}

/**
 *   approved  cuenta en los totales
 *   review    «Por revisar»: falta el producto o el monto; no cuenta todavía
 *   void      anulada (devolución, pago falso, duplicada): se conserva, no cuenta
 */
export const SALE_STATUSES = ["approved", "review", "void"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

/** De dónde vino: el bloque Comprobante, un asesor o un webhook de entrada. */
export const SALE_SOURCES = ["receipt", "manual", "webhook"] as const;
export type SaleSource = (typeof SALE_SOURCES)[number];

export interface SaleSummary {
  readonly id: string;
  readonly status: SaleStatus;
  readonly source: SaleSource;
  readonly productId: string | null;
  /** El nombre al momento de la venta (si luego se renombra el producto, la venta no cambia). */
  readonly productName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly contactId: string | null;
  /** El número de WhatsApp de la cuenta que vendió. */
  readonly connectionName: string | null;
  readonly flowName: string | null;
  /** Id del anuncio de clic a WhatsApp por el que llegó el cliente. */
  readonly adSourceId: string | null;
  readonly receiptReference: string | null;
  /** Por qué quedó «Por revisar» o por qué se anuló. */
  readonly reviewReason: string | null;
  readonly note: string;
  /** Quien la anotó a mano o la revisó por última vez. */
  readonly recordedByName: string | null;
  readonly soldAt: string;
}

/** Lo vendido en una moneda: los montos de monedas distintas nunca se suman. */
export interface SalesTotal {
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
}

export interface SaleListResponse {
  readonly sales: ReadonlyArray<SaleSummary>;
  /** Solo ventas aprobadas, con los mismos filtros (sin la página). */
  readonly totals: ReadonlyArray<SalesTotal>;
  /** Ventas «Por revisar» de toda la cuenta (el número de la pestaña). */
  readonly reviewCount: number;
  readonly nextCursor: string | null;
  /** Anotar ventas a mano (`sales.write`). */
  readonly canRecord: boolean;
  /** Revisar, corregir y anular (`sales.manage`). */
  readonly canManage: boolean;
}

export interface SaleFilters {
  readonly status?: SaleStatus;
  readonly productId?: string;
  readonly currency?: string;
  readonly source?: SaleSource;
  /** Desde (inclusive), `YYYY-MM-DD` en la zona de la empresa. */
  readonly from?: string;
  /** Hasta (inclusive), `YYYY-MM-DD` en la zona de la empresa. */
  readonly to?: string;
  /** Nombre o teléfono del cliente, referencia del comprobante o id del anuncio. */
  readonly search?: string;
  readonly cursor?: string;
}

/** Venta anotada por un asesor. Sin producto o sin monto queda «Por revisar». */
export interface RecordSaleRequest {
  readonly productId?: string | null;
  /** Número o como lo escribe la persona («49.900», «12,5»): el servidor lo lee con la regla del Comprobante. */
  readonly amount?: number | string | null;
  readonly currency?: string | null;
  readonly country?: string | null;
  readonly customerName?: string | null;
  readonly customerPhone?: string | null;
  readonly soldAt?: string;
  readonly note?: string;
  /**
   * Anotada desde un chat: el servidor toma de ese chat el cliente, el número
   * y el anuncio por el que llegó (cuenta para su ROAS). Exige ver los chats.
   */
  readonly conversationId?: string;
}

/** Corregir una venta (completar la que está «Por revisar») o anularla. */
export interface UpdateSaleRequest {
  readonly productId?: string | null;
  readonly amount?: number | string | null;
  readonly currency?: string | null;
  readonly country?: string | null;
  readonly customerName?: string | null;
  readonly note?: string;
  /** `approved` aprueba (si está completa); `void` anula con un motivo. */
  readonly status?: SaleStatus;
  readonly voidReason?: string;
}
