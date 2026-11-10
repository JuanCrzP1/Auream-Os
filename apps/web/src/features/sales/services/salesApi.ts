import { builderApiClient } from "@shared/http/builderApiClient";
import type { RecordSaleRequest, SaleFilters, SaleListResponse, SaleSummary, UpdateSaleRequest } from "@contracts/SalesContracts";

// Ventas de la cuenta activa (`/sales`). El catálogo vive en `shared/products`
// porque también lo usa el editor de flujos.

export function fetchSales(filters: SaleFilters): Promise<SaleListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
  const suffix = query.toString();
  return builderApiClient.get<SaleListResponse>(`/sales${suffix ? `?${suffix}` : ""}`);
}

export function recordSale(request: RecordSaleRequest): Promise<SaleSummary> {
  return builderApiClient.post<SaleSummary>("/sales", request);
}

export function updateSale(id: string, request: UpdateSaleRequest): Promise<SaleSummary> {
  return builderApiClient.patch<SaleSummary>(`/sales/${encodeURIComponent(id)}`, request);
}
