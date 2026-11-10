import type { SaleSummary } from "../../../contracts/SalesContracts";
import type { SaleCursor, SaleRecord } from "./SaleRepository";

// Cómo sale una venta por la API y la posición de la página siguiente.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: SaleCursor): string {
  return Buffer.from(`${cursor.soldAt}|${cursor.id}`).toString("base64url");
}

export function decodeCursor(value: string | undefined): SaleCursor | null {
  if (!value) return null;
  const [soldAt, id] = Buffer.from(value, "base64url").toString("utf8").split("|");
  return soldAt && id && UUID.test(id) && !Number.isNaN(new Date(soldAt).getTime()) ? { soldAt, id } : null;
}

export function toSummary(sale: SaleRecord): SaleSummary {
  return {
    id: sale.id,
    status: sale.status,
    source: sale.source,
    productId: sale.productId,
    productName: sale.productName,
    amount: sale.amount,
    currency: sale.currency,
    country: sale.country,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    contactId: sale.contactId,
    connectionName: sale.connectionName,
    flowName: sale.flowName,
    adSourceId: sale.adSourceId,
    receiptReference: sale.receiptReference,
    reviewReason: sale.reviewReason,
    note: sale.note,
    recordedByName: sale.recordedByName,
    soldAt: sale.soldAt
  };
}
