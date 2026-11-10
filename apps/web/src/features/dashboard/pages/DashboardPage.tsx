import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "./dashboard-page.css";
import { useSearchParams } from "react-router-dom";
import { useAdAccounts } from "@shared/ads/useAdAccounts";
import { useConnections } from "@shared/connections/useConnections";
import { useProductCatalog } from "@shared/products/useProductCatalog";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { AdsTab } from "../ads/AdsTab";
import { AttentionTab } from "../attention/AttentionTab";
import { DashboardFilters } from "../components/DashboardFilters";
import { PERIODS, PERIOD_WORDS, rangeOf, type PeriodId } from "../dashboardFormat";
import { SalesTab } from "../sales/SalesTab";

type Tab = "sales" | "ads" | "attention";
const isTab = (value: string | null): value is Tab => value === "sales" || value === "ads" || value === "attention";
const isPeriod = (value: string | null): value is PeriodId => PERIODS.some(([id]) => id === value);

/**
 * Dashboard: cómo va el negocio. Ventas (con la plata de los anuncios: ROAS
 * real, gasto y ganancia), Anuncios (cada campaña con su venta real frente a
 * Meta) y Atención (leads, tiempos y asesores). La pestaña, el periodo y los
 * filtros viajan en la dirección. Anuncios solo para quien ve el gasto.
 */
export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const ads = useAdAccounts();
  const { connections } = useConnections();
  const catalog = useProductCatalog();
  // Hasta saber si puede ver el gasto no se pide nada de anuncios.
  const canSeeAds = ads.status === "ready";
  const adsPending = ads.status === "loading";
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) && (requested !== "ads" || canSeeAds || adsPending) ? requested : "sales";
  const period: PeriodId = isPeriod(params.get("period")) ? (params.get("period") as PeriodId) : "30d";
  const connectionId = params.get("connection") ?? "";
  const productId = params.get("product") ?? "";
  const filters = { ...rangeOf(period), ...(connectionId ? { connectionId } : {}), ...(productId && tab === "sales" ? { productId } : {}) };

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
        <DashboardFilters
          period={period}
          connectionId={connectionId}
          productId={productId}
          connections={connections}
          products={catalog.products}
          showProduct={tab === "sales"}
          onPeriod={(next) => set({ period: next === "30d" ? null : next })}
          onConnection={(id) => set({ connection: id || null })}
          onProduct={(id) => set({ product: id || null })}
        />
      </header>
      <div className="ui-panel dashboard-page__panel">
        <PillTabs
          label="Secciones del Dashboard"
          tabs={[{ id: "sales", label: "Ventas" }, ...(canSeeAds ? [{ id: "ads" as const, label: "Anuncios" }] : []), { id: "attention", label: "Atención" }]}
          selected={tab}
          onSelect={(next) => set({ tab: next === "sales" ? null : next })}
        />
        <div role="tabpanel" aria-label={tab === "ads" ? "Anuncios" : tab === "attention" ? "Atención" : "Ventas"}>
          {tab === "sales" ? <SalesTab filters={filters} periodWords={PERIOD_WORDS[period]} onSeeAds={() => set({ tab: "ads" })} /> : null}
          {tab === "ads" ? (canSeeAds ? <AdsTab filters={filters} /> : <div className="dashboard-page__wait" aria-busy="true" aria-label="Cargando" />) : null}
          {tab === "attention" ? <AttentionTab filters={filters} /> : null}
        </div>
      </div>
    </div>
  );
}
