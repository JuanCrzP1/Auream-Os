import { builderApiClient } from "@shared/http/builderApiClient";
import type { SaleFilters, SaleListResponse, SaleSummary, UpdateSaleRequest } from "@contracts/SalesContracts";
import type { ProductStatsResponse, SalesInsightsResponse } from "@contracts/SalesInsightsContracts";

// Ventas de la cuenta activa (`/sales`). El catálogo vive en `shared/products`
// porque también lo usa el editor de flujos.

export function fetchSales(filters: SaleFilters): Promise<SaleListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
  const suffix = query.toString();
  return builderApiClient.get<SaleListResponse>(`/sales${suffix ? `?${suffix}` : ""}`);
}

export function updateSale(id: string, request: UpdateSaleRequest): Promise<SaleSummary> {
  return builderApiClient.patch<SaleSummary>(`/sales/${encodeURIComponent(id)}`, request);
}

export function fetchSalesInsights(filters: Pick<SaleFilters, "from" | "to" | "productId">): Promise<SalesInsightsResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, String(value));
  const suffix = query.toString();
  return builderApiClient.get<SalesInsightsResponse>(`/sales/insights${suffix ? `?${suffix}` : ""}`);
}

export function fetchProductStats(): Promise<ProductStatsResponse> {
  return builderApiClient.get<ProductStatsResponse>("/sales/product-stats");
}
