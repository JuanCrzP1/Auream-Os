import { builderApiClient } from "@shared/http/builderApiClient";
import type { AdsAccountsResponse, MetaOAuthStartResponse } from "@contracts/AdsContracts";
import type { AdLevel, AdsDashboardResponse, DashboardFilters } from "@contracts/DashboardContracts";

// Meta Ads de la cuenta activa (`/ads`) y su rendimiento (`/dashboard/ads`).
// Lo usan Meta Ads (Cuentas y Rendimiento) y el Dashboard.

const id = (value: string) => encodeURIComponent(value);

export function dashboardQuery(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const adsApi = {
  accounts: () => builderApiClient.get<AdsAccountsResponse>("/ads/accounts"),
  startOAuth: () => builderApiClient.post<MetaOAuthStartResponse>("/ads/meta/oauth"),
  connectToken: (accessToken: string) => builderApiClient.post<AdsAccountsResponse>("/ads/meta/token", { accessToken }),
  setEnabled: (accountId: string, enabled: boolean) => builderApiClient.patch<AdsAccountsResponse>(`/ads/accounts/${id(accountId)}`, { enabled }),
  sync: (accountId: string) => builderApiClient.post<{ queued: boolean }>(`/ads/accounts/${id(accountId)}/sync`),
  disconnect: () => builderApiClient.delete("/ads/connection"),
  performance: (filters: DashboardFilters, level: AdLevel) =>
    builderApiClient.get<AdsDashboardResponse>(`/dashboard/ads${dashboardQuery({ from: filters.from, to: filters.to, level })}`)
};
