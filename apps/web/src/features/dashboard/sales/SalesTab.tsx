import "./sales-tab.css";
import { useCallback, useEffect, useState } from "react";
import type { AdsDashboardResponse, DashboardFilters, SalesDashboardResponse } from "@contracts/DashboardContracts";
import { adsApi } from "@shared/ads/adsApi";
import { dashboardApi } from "../services/dashboardApi";
import { useDashboardData } from "../useDashboardData";
import { AdFunnel } from "./AdFunnel";
import { AdsHero } from "./AdsHero";
import { Breakdowns } from "./Breakdowns";
import { CampaignAdvice } from "./CampaignAdvice";
import { OtherExpensesDialog } from "./expenses/OtherExpensesDialog";
import { ConnectMetaInvite } from "./ConnectMetaInvite";
import { RecentSales } from "./RecentSales";
import { chartUnit } from "./chartBuckets";
import { DownloadSalesButton } from "./export/DownloadSalesButton";
import { LineComparison } from "./lines/LineComparison";
import { RevenueChart } from "./RevenueChart";
import { SalesSummary } from "./summary/SalesSummary";

/** Se mira todo el negocio: sin línea ni filtros a mano («*» = todos, a propósito). */
const wholeBusiness = (filters: DashboardFilters) =>
  !filters.lineId && [filters.connectionIds, filters.productIds, filters.campaignIds].every((list) => !list || (list.length === 1 && list[0] === "*"));

/**
 * Dashboard › Ventas: primero la plata de los anuncios (ROAS real, gasto,
 * ganancia), luego el resumen del periodo (ocho números con su cambio, y
 * desde la inversión, los otros gastos), mirando todo el negocio cómo va
 * cada línea de venta,
 * facturación y gasto por día, del anuncio a
 * la venta, qué hacer con cada campaña, por hora, número, producto y país, y
 * las últimas ventas con su anuncio.
 */
export function SalesTab({ filters, periodWords, onSeeAds, onReportCurrency, onSelectLine }: {
  readonly filters: DashboardFilters;
  readonly periodWords: string;
  readonly onSeeAds: () => void;
  /** Elegir una línea en todo el Dashboard (desde Comparar líneas). */
  readonly onSelectLine?: (lineId: string) => void;
  /** La moneda en que llegó el informe (para el botón de moneda). */
  readonly onReportCurrency?: (code: string) => void;
}) {
  // Al guardar o borrar un gasto, el informe se vuelve a pedir (cambia la ganancia).
  const [version, setVersion] = useState(0);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const reload = useCallback(() => setVersion((n) => n + 1), []);
  const key = `${JSON.stringify(filters)}#${version}`;
  const sales = useDashboardData<SalesDashboardResponse>(() => dashboardApi.sales(filters), key);
  const view = sales.data;
  const reported = view?.currency;
  useEffect(() => {
    if (reported) onReportCurrency?.(reported);
    // Solo cuando cambia la moneda del informe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reported]);
  const wantsAds = Boolean(view?.ads);
  const campaigns = useDashboardData<AdsDashboardResponse | null>(() => (wantsAds ? adsApi.performance(filters, "campaign") : Promise.resolve(null)), `${key}:${wantsAds}`);

  if (sales.failed) return <p className="ui-error" role="alert">No pudimos cargar el Dashboard. Vuelve a intentarlo en unos segundos.</p>;
  if (!view) return <div className="sales-tab__loading" aria-busy="true" aria-label="Cargando el Dashboard" />;

  return (
    <div className="sales-tab">
      {view.ads ? <AdsHero view={view} periodWords={periodWords} /> : view.canSeeAds ? <ConnectMetaInvite /> : null}
      <SalesSummary view={view} onOpenExpenses={() => setExpensesOpen(true)} />
      {expensesOpen ? (
        <OtherExpensesDialog
          charges={view.otherExpenses}
          total={view.otherSpend?.value ?? 0}
          currency={view.currency}
          periodWords={periodWords}
          lineId={filters.lineId ?? null}
          onChanged={reload}
          onClose={() => setExpensesOpen(false)}
        />
      ) : null}
      {onSelectLine && wholeBusiness(filters) ? (
        <LineComparison range={{ from: filters.from, to: filters.to }} currency={filters.currency} periodWords={periodWords} version={version} onSelectLine={onSelectLine} />
      ) : null}
      <section className="sales-tab__card" aria-labelledby="sales-chart-title">
        <header className="sales-tab__card-header">
          <h2 id="sales-chart-title">{view.ads ? "Facturación y gasto" : "Facturación"} por {chartUnit(view.daily.length) === "week" ? "semana" : "día"}</h2>
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
      <RecentSales sales={view.recentSales} download={view.canExport ? <DownloadSalesButton filters={filters} sales={view.sales.value} /> : null} />
    </div>
  );
}
