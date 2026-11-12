import "./sales-tab.css";
import type { AdsDashboardResponse, DashboardFilters, SalesDashboardResponse } from "@contracts/DashboardContracts";
import { adsApi } from "@shared/ads/adsApi";
import { dashboardApi } from "../services/dashboardApi";
import { useDashboardData } from "../useDashboardData";
import { AdFunnel } from "./AdFunnel";
import { AdsHero } from "./AdsHero";
import { Breakdowns } from "./Breakdowns";
import { CampaignAdvice } from "./CampaignAdvice";
import { ConnectMetaInvite } from "./ConnectMetaInvite";
import { RecentSales } from "./RecentSales";
import { RevenueChart } from "./RevenueChart";
import { SalesSummary } from "./summary/SalesSummary";

/**
 * Dashboard › Ventas: primero la plata de los anuncios (ROAS real, gasto,
 * ganancia), luego el resumen del periodo (ocho números con su cambio),
 * facturación y gasto por día, del anuncio a
 * la venta, qué hacer con cada campaña, por hora, número, producto y país, y
 * las últimas ventas con su anuncio.
 */
export function SalesTab({ filters, periodWords, onSeeAds }: { readonly filters: DashboardFilters; readonly periodWords: string; readonly onSeeAds: () => void }) {
  const key = JSON.stringify(filters);
  const sales = useDashboardData<SalesDashboardResponse>(() => dashboardApi.sales(filters), key);
  const view = sales.data;
  const wantsAds = Boolean(view?.ads);
  const campaigns = useDashboardData<AdsDashboardResponse | null>(() => (wantsAds ? adsApi.performance(filters, "campaign") : Promise.resolve(null)), `${key}:${wantsAds}`);

  if (sales.failed) return <p className="ui-error" role="alert">No pudimos cargar el Dashboard. Vuelve a intentarlo en unos segundos.</p>;
  if (!view) return <div className="sales-tab__loading" aria-busy="true" aria-label="Cargando el Dashboard" />;

  return (
    <div className="sales-tab">
      {view.ads ? <AdsHero view={view} periodWords={periodWords} /> : view.canSeeAds ? <ConnectMetaInvite /> : null}
      <SalesSummary view={view} />
      <section className="sales-tab__card" aria-labelledby="sales-chart-title">
        <header className="sales-tab__card-header">
          <h2 id="sales-chart-title">{view.ads ? "Facturación y gasto por día" : "Facturación por día"}</h2>
          <span className="sales-tab__legend">
            <span><i className="sales-tab__key sales-tab__key--line" />Facturación ({view.currency})</span>
            {view.ads ? <span><i className="sales-tab__key sales-tab__key--bar" />Gasto en Meta</span> : null}
            {view.ads ? <span><i className="sales-tab__key sales-tab__key--dash" />Ganancia</span> : null}
          </span>
        </header>
        <RevenueChart points={view.daily} currency={view.currency} withSpend={Boolean(view.ads)} />
      </section>
      {view.funnel ? <AdFunnel view={view} /> : null}
      {campaigns.data ? <CampaignAdvice data={campaigns.data} onSeeAll={onSeeAds} /> : null}
      <Breakdowns view={view} />
      <RecentSales sales={view.recentSales} />
    </div>
  );
}
