import { builderApiClient } from "@shared/http/builderApiClient";
import { dashboardQuery } from "@shared/ads/adsApi";
import type { DashboardFilters, SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { AttentionDashboardResponse } from "@contracts/AttentionContracts";

// El Dashboard de la cuenta activa (`/dashboard/*`). Anuncios usa `shared/ads`.

const query = (filters: DashboardFilters) => dashboardQuery({ ...filters });

export const dashboardApi = {
  sales: (filters: DashboardFilters) => builderApiClient.get<SalesDashboardResponse>(`/dashboard/sales${query(filters)}`),
  attention: (filters: DashboardFilters) => builderApiClient.get<AttentionDashboardResponse>(`/dashboard/attention${query(filters)}`)
};
