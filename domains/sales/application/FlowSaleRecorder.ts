import { countryOfPhone, findCountry } from "../../../contracts/Countries";
import { parseCurrency, parseMoney } from "../domain/Money";
import { cleanText, initialStatus, type NewSale } from "../domain/Sale";
import type { ProductCatalog } from "./ProductCatalog";
import { NO_SALE_EVENTS, approvedEventOf, type SaleEvents } from "./SaleEvents";
import type { SaleRepository } from "./SaleRepository";

// ---------------------------------------------------------------------------
// FlowSaleRecorder — las ventas que registra el bloque «Registrar venta».
//
// Decide con los datos del paso: el producto (activo, de la cuenta), el monto
// y la moneda (de las variables o del precio del producto en el país del
// cliente) y si cuenta o queda «Por revisar». NUNCA inventa un precio.
//
// `preview` calcula lo mismo sin guardar (simulación del builder).
// Idempotente: el mismo comprobante (referencia) o el mismo paso repetido por
// un reintento devuelve la venta que ya existe.
// ---------------------------------------------------------------------------

export interface FlowSaleInput {
  readonly productId: string;
  readonly amountMode: "variable" | "product";
  readonly amount: string;
  readonly currency: string;
  readonly customerName: string;
  readonly reference: string;
  readonly contactId: string | null;
  readonly contactName: string | null;
  readonly customerPhone: string | null;
  readonly connectionId: string | null;
  readonly flowKey: string;
  readonly adSourceId: string | null;
  readonly soldAt: string;
  readonly stepKey: string;
}

export interface FlowSaleDecision {
  readonly id: string | null;
  readonly status: "approved" | "review";
  readonly productName: string | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly reviewReason: string | null;
  readonly duplicate: boolean;
  readonly saved: boolean;
}

export class FlowSaleRecorder {
  public constructor(
    private readonly sales: SaleRepository,
    private readonly catalog: ProductCatalog,
    private readonly events: SaleEvents = NO_SALE_EVENTS
  ) {}

  public async record(tenantId: string, input: FlowSaleInput): Promise<FlowSaleDecision> {
    const { sale, status, reviewReason } = await this.decide(tenantId, input);
    const saved = await this.sales.insert(tenantId, sale, status, reviewReason);
    // Un comprobante repetido no vuelve a avisar.
    if (saved.created && saved.sale.status === "approved") await this.events.saleApproved(tenantId, approvedEventOf(saved.sale));
    return {
      id: saved.sale.id,
      status: saved.sale.status === "approved" ? "approved" : "review",
      productName: saved.sale.productName,
      amount: saved.sale.amount,
      currency: saved.sale.currency,
      country: saved.sale.country,
      reviewReason: saved.sale.reviewReason,
      duplicate: !saved.created,
      saved: true
    };
  }

  public async preview(tenantId: string, input: FlowSaleInput): Promise<FlowSaleDecision> {
    const { sale, status, reviewReason } = await this.decide(tenantId, input);
    return {
      id: null,
      status: status === "approved" ? "approved" : "review",
      productName: sale.productName,
      amount: sale.amount,
      currency: sale.currency,
      country: sale.country,
      reviewReason,
      duplicate: false,
      saved: false
    };
  }

  private async decide(tenantId: string, input: FlowSaleInput) {
    const product = await this.catalog.findActive(tenantId, input.productId);
    const country = countryOfPhone(input.customerPhone);
    let amount: number | null = null;
    let currency: string | null = null;
    let reason: string | null = null;

    if (!product) {
      reason = "El producto del bloque ya no existe o está archivado.";
    } else if (input.amountMode === "product") {
      const price = country ? product.prices.find((entry) => entry.country === country) : undefined;
      if (price) {
        amount = price.amount;
        currency = price.currency;
      } else {
        reason = country
          ? `«${product.name}» no tiene precio en ${findCountry(country).name}.`
          : "No se supo el país del cliente para usar el precio del producto.";
      }
    } else {
      amount = parseMoney(input.amount);
      currency = parseCurrency(input.currency);
      if (amount === null) reason = input.amount.trim() ? `No se entendió el monto «${input.amount.trim().slice(0, 40)}».` : "El comprobante no trajo el monto.";
      else if (currency === null) reason = input.currency.trim() ? `«${input.currency.trim().slice(0, 12)}» no es una moneda de la lista.` : "No se supo la moneda.";
    }

    const reference = cleanText(input.reference, 120);
    const sale: NewSale = {
      tenantId,
      source: "receipt",
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      amount,
      currency,
      country,
      contactId: input.contactId,
      customerName: cleanText(input.customerName, 120) ?? cleanText(input.contactName, 120),
      customerPhone: input.customerPhone,
      connectionId: input.connectionId,
      flowKey: input.flowKey,
      adSourceId: input.adSourceId,
      receiptReference: reference,
      note: "",
      recordedBy: null,
      soldAt: input.soldAt,
      // El mismo comprobante (referencia) no se registra dos veces; sin referencia, el mismo paso tampoco.
      originKey: reference ? `ref:${reference.toLowerCase()}` : `step:${input.stepKey}`
    };
    const decided = initialStatus({ productId: sale.productId, amount, currency }, reason);
    return { sale, status: decided.status, reviewReason: decided.reviewReason };
  }
}
