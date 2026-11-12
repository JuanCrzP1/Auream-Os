import { builderApiClient } from "@shared/http/builderApiClient";
import type { RecordSaleRequest, SaleSummary } from "@contracts/SalesContracts";

/** Anotar una venta (`POST /sales`): desde Ventas o desde un chat (`conversationId`). */
export function recordSale(request: RecordSaleRequest): Promise<SaleSummary> {
  return builderApiClient.post<SaleSummary>("/sales", request);
}
