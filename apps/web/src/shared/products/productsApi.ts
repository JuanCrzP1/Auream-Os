import { builderApiClient } from "@shared/http/builderApiClient";
import type { ProductListResponse, ProductSummary, SaveProductRequest } from "@contracts/SalesContracts";

// El catálogo de la cuenta activa (`/products`). Lo usan Ventas → Productos y
// el bloque Registrar venta del editor de flujos.

export function fetchProducts(): Promise<ProductListResponse> {
  return builderApiClient.get<ProductListResponse>("/products");
}

export function createProduct(request: SaveProductRequest): Promise<ProductSummary> {
  return builderApiClient.post<ProductSummary>("/products", request);
}

export function updateProduct(id: string, request: SaveProductRequest): Promise<ProductSummary> {
  return builderApiClient.patch<ProductSummary>(`/products/${encodeURIComponent(id)}`, request);
}
