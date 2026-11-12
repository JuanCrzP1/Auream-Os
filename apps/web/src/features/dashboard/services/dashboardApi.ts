import { builderApiClient } from "@shared/http/builderApiClient";
import { dashboardQuery, filtersQuery } from "@shared/ads/adsApi";
import type { DashboardFilters, FxRatesResponse, SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { AttentionDashboardResponse } from "@contracts/AttentionContracts";
import type { LineComparisonResponse } from "@contracts/LineComparisonContracts";

// El Dashboard de la cuenta activa (`/dashboard/*`). Anuncios usa `shared/ads`.

const query = (filters: DashboardFilters) => dashboardQuery(filtersQuery(filters));

export const dashboardApi = {
  sales: (filters: DashboardFilters) => builderApiClient.get<SalesDashboardResponse>(`/dashboard/sales${query(filters)}`),
  attention: (filters: DashboardFilters) => builderApiClient.get<AttentionDashboardResponse>(`/dashboard/attention${query(filters)}`),
  /** Comparar líneas: cada línea en el mismo periodo y moneda (las líneas mandan en lo demás). */
  lines: (filters: Pick<DashboardFilters, "from" | "to" | "currency">) =>
    builderApiClient.get<LineComparisonResponse>(`/dashboard/lines${dashboardQuery({ from: filters.from, to: filters.to, currency: filters.currency })}`),
  /** Las tasas de cambio oficiales más recientes (para el menú de moneda). */
  fx: () => builderApiClient.get<FxRatesResponse>("/dashboard/fx")
};
