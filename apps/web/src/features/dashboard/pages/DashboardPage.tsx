import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "./dashboard-page.css";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdAccounts } from "@shared/ads/useAdAccounts";
import { useConnections } from "@shared/connections/useConnections";
import { useProductCatalog } from "@shared/products/useProductCatalog";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { AdsTab } from "../ads/AdsTab";
import { AttentionTab } from "../attention/AttentionTab";
import { DashboardFilters } from "../components/DashboardFilters";
import { periodParams, periodWords, readPeriod } from "../period/periodModel";
import { SalesTab } from "../sales/SalesTab";
import { readSelection, selectionFilters, selectionParams } from "../scope/dashboardScope";
import { ScopeBar } from "../scope/ScopeBar";

type Tab = "sales" | "ads" | "attention";
const isTab = (value: string | null): value is Tab => value === "sales" || value === "ads" || value === "attention";

/**
 * Dashboard: cómo va el negocio. Ventas (con la plata de los anuncios: ROAS
 * real, gasto y ganancia), Anuncios (cada campaña con su venta real frente a
 * Meta) y Atención (leads, tiempos y asesores). Junto a las pestañas, la línea
 * de venta, los filtros y la moneda. Todo viaja en la dirección. Anuncios
 * solo para quien ve el gasto.
 */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const ads = useAdAccounts();
  const { connections } = useConnections();
  const catalog = useProductCatalog();
  // La moneda que usa el informe sin elegir ninguna (la dice la API en cada respuesta).
  const [automaticCurrency, setAutomaticCurrency] = useState("COP");
  // Hasta saber si puede ver el gasto no se pide nada de anuncios.
  const canSeeAds = ads.status === "ready";
  const adsPending = ads.status === "loading";
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) && (requested !== "ads" || canSeeAds || adsPending) ? requested : "sales";
  const period = readPeriod(params);
  const selection = readSelection(params);
  const range = { from: period.from, to: period.to };
  const filters = { ...range, ...selectionFilters(selection) };
  const onReportCurrency = (code: string) => {
    if (!selection.currency) setAutomaticCurrency(code);
  };

  const set = (changes: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });

  return (
    <div className="ui-page dashboard-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Dashboard</h1>
          <p className="ui-page__subtitle">Así va tu negocio: lo que vendes, lo que te cuestan los anuncios y cómo atiendes.</p>
        </div>
        <DashboardFilters period={period} onPeriod={(next) => set(periodParams(next))} />
      </header>
      <div className="ui-panel dashboard-page__panel">
        <div className="dashboard-page__tabs">
          <PillTabs
            label="Secciones del Dashboard"
            tabs={[{ id: "sales", label: "Ventas" }, ...(canSeeAds ? [{ id: "ads" as const, label: "Anuncios" }] : []), { id: "attention", label: "Atención" }]}
            selected={tab}
            onSelect={(next) => set({ tab: next === "sales" ? null : next })}
          />
          <ScopeBar
            selection={selection}
            onChange={(next) => set(selectionParams(next))}
            connections={connections}
            products={catalog.products}
            canSeeAds={canSeeAds}
            range={range}
            automaticCurrency={automaticCurrency}
          />
        </div>
        <div role="tabpanel" aria-label={tab === "ads" ? "Anuncios" : tab === "attention" ? "Atención" : "Ventas"}>
          {tab === "sales" ? <SalesTab filters={filters} periodWords={periodWords(period)} onSeeAds={() => set({ tab: "ads" })} onReportCurrency={onReportCurrency} /> : null}
          {tab === "ads" ? (canSeeAds ? <AdsTab filters={filters} /> : <div className="dashboard-page__wait" aria-busy="true" aria-label="Cargando" />) : null}
          {tab === "attention" ? <AttentionTab filters={filters} /> : null}
        </div>
      </div>
    </div>
  );
}
