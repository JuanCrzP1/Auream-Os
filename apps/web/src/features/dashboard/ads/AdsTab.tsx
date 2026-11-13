import "./ads-tab.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { AdLevel, AdsDashboardResponse, DashboardFilters } from "@contracts/DashboardContracts";
import { adsApi } from "@shared/ads/adsApi";
import { AdsPerformanceTable } from "@shared/ads/AdsPerformanceTable";
import { formatPercent, formatRoas } from "@shared/ads/adsFormat";
import { timeAgo } from "@shared/format/timeAgo";
import { money } from "../dashboardFormat";
import { useDashboardData } from "../useDashboardData";

const LEVELS: ReadonlyArray<readonly [AdLevel, string]> = [["campaign", "Campañas"], ["adset", "Conjuntos"], ["ad", "Anuncios"]];

/**
 * Dashboard › Anuncios: el resumen de la plata de los anuncios, cada campaña,
 * conjunto o anuncio con su venta real frente a Meta y qué hacer, y por qué
 * Meta dice menos.
 */
export function AdsTab({ filters }: { readonly filters: DashboardFilters }) {
  const [level, setLevel] = useState<AdLevel>("campaign");
  const { data, failed } = useDashboardData<AdsDashboardResponse>(() => adsApi.performance(filters, level), `${JSON.stringify(filters)}:${level}`);
  if (failed) return <p className="ui-error" role="alert">No pudimos cargar los anuncios. Vuelve a intentarlo en unos segundos.</p>;
  if (!data) return <div className="ads-tab__loading" aria-busy="true" aria-label="Cargando los anuncios" />;
  if (!data.connected) {
    return (
      <div className="ads-tab__empty">
        <h2>Conecta Meta Ads para ver tus campañas</h2>
        <p className="ui-muted">Gasto, chats, ventas reales, ganancia y ROAS de cada campaña, conjunto y anuncio.</p>
        <Link className="ui-btn ui-btn--primary" to="/meta-ads?tab=accounts">Conectar Meta Ads</Link>
      </div>
    );
  }
  if (data.lineWithoutCampaigns) {
    return (
      <div className="ads-tab__empty">
        <h2>Esta línea no tiene campañas</h2>
        <p className="ui-muted">Sus ventas se ven en Ventas, pero no su gasto ni su ROAS. Edita la línea y elige las campañas que la promocionan para verla completa.</p>
      </div>
    );
  }
  const t = data.totals;
  const tops = [
    { label: "ROAS real", value: formatRoas(t.roas), note: `Meta dice ${formatRoas(t.roasMeta)}`, lead: true },
    { label: "Ganancia", value: money(t.profit, data.currency), note: "ventas por anuncio − gasto", lead: true },
    { label: "Gasto", value: money(t.spend, data.currency), note: `${t.clicks.toLocaleString("es-CO")} clics · CTR ${formatPercent(t.ctr)}` },
    { label: "Costo por venta", value: money(t.costPerSale, data.currency), note: `${t.sales} ventas por anuncio` },
    { label: "Costo por chat", value: money(t.costPerChat, data.currency), note: `${t.chats.toLocaleString("es-CO")} chats` }
  ];
  const best = [...data.rows].filter((row) => row.sales >= 3 && row.roas !== null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0];

  return (
    <div className="ads-tab">
      <section className="ads-tab__tops" aria-label="Resumen de anuncios">
        {tops.map((top) => (
          <div key={top.label} className={`ads-tab__top${top.lead ? " ads-tab__top--lead" : ""}`}>
            <span className="ads-tab__label">{top.label}</span>
            <strong>{top.value}</strong>
            <span className="ui-muted">{top.note}</span>
          </div>
        ))}
      </section>
      <div className="ads-tab__bar">
        <div className="ads-tab__levels" role="tablist" aria-label="Nivel">
          {LEVELS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={level === id} onClick={() => setLevel(id)}>{label}</button>)}
        </div>
        <span className="ui-muted">«Auream / Meta»: ventas reales frente a lo que reporta Meta{data.lastSyncedAt ? ` · actualizado ${timeAgo(data.lastSyncedAt)}` : ""}</span>
      </div>
      {data.rows.length === 0 ? <p className="ui-muted">Sin gasto ni ventas por anuncio en este periodo.</p> : <AdsPerformanceTable data={data} />}
      <div className="ads-tab__notes">
        <section className="ads-tab__why" aria-labelledby="ads-why-title">
          <h2 id="ads-why-title">¿Por qué Meta dice menos?</h2>
          <p>Cuando alguien toca tu anuncio y te escribe, la compra pasa en el chat y el Píxel no la ve completa. Auream sabe de qué anuncio llegó cada cliente y le cuenta la venta a ese anuncio, aunque compre días después.</p>
          <div className="ads-tab__facts">
            <span><strong>{data.unseenSales}</strong> ventas que Meta no vio</span>
            <span><strong>{formatPercent(data.lateShare, 0)}</strong> compran después del primer día de chat</span>
          </div>
        </section>
        {best ? (
          <section className="ads-tab__best" aria-labelledby="ads-best-title">
            <h2 id="ads-best-title">Lo que mejor rinde</h2>
            {best.thumbnailUrl ? <img src={best.thumbnailUrl} alt="" className="ads-tab__thumb" /> : null}
            <strong>{best.name}</strong>
            <span className="ui-muted">{best.sales} ventas · ROAS {formatRoas(best.roas)} · costo por venta {money(best.costPerSale, data.currency)}</span>
          </section>
        ) : null}
      </div>
    </div>
  );
}
