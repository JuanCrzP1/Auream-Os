import { builderApiClient } from "@shared/http/builderApiClient";
import type { SalesLineListResponse, SalesLineSummary, SaveSalesLineRequest } from "@contracts/SalesLineContracts";

// Las líneas de venta de la cuenta activa (`/sales-lines`). Las usa el Dashboard.

const id = (value: string) => encodeURIComponent(value);

export const salesLinesApi = {
  list: () => builderApiClient.get<SalesLineListResponse>("/sales-lines"),
  create: (request: SaveSalesLineRequest) => builderApiClient.post<SalesLineSummary>("/sales-lines", request),
  update: (lineId: string, request: Partial<SaveSalesLineRequest>) => builderApiClient.patch<SalesLineSummary>(`/sales-lines/${id(lineId)}`, request),
  remove: (lineId: string) => builderApiClient.delete(`/sales-lines/${id(lineId)}`)
};
