import "./sales-kpis.css";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { money, trendText } from "../dashboardFormat";

/** Las ventas y la atención en cuatro números (con su cambio frente al periodo anterior). */
export function SalesKpis({ view }: { readonly view: SalesDashboardResponse }) {
  const items = [
    { label: "Facturación", value: money(view.revenue.value, view.currency), trend: trendText(view.revenue), note: view.missingRates.length > 0 ? `Sin cambio para ${view.missingRates.join(", ")}` : `${view.sales.value} ventas · ticket ${money(view.averageTicket, view.currency)}` },
    { label: "Leads nuevos", value: view.leads.value.toLocaleString("es-CO"), trend: trendText(view.leads), note: `${view.leadsFromAds.toLocaleString("es-CO")} por anuncio · ${(view.leads.value - view.leadsFromAds).toLocaleString("es-CO")} orgánicos` },
    { label: "Tasa de conversión", value: view.conversion === null ? "—" : `${(view.conversion * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`, trend: null, note: view.conversion === null ? "Aún no hay chats" : `de cada 100 chats, ${Math.round(view.conversion * 100)} compran` },
    { label: "Ganancia real", value: view.realProfit === null ? "—" : money(view.realProfit, view.currency), trend: null, note: view.costsKnown ? "ventas − costo de productos − anuncios" : "Pon el costo de tus productos en Ventas › Productos" }
  ];
  return (
    <section className="sales-kpis" aria-label="Ventas y leads">
      {items.map((item) => (
        <div key={item.label} className="sales-kpis__card">
          <span className="sales-kpis__top">
            <span className="sales-kpis__label">{item.label}</span>
            {item.trend ? <span className={`sales-kpis__chip sales-kpis__chip--${item.trend.tone}`}>{item.trend.text}</span> : null}
          </span>
          <span className="sales-kpis__value">{item.value}</span>
          <span className="sales-kpis__note">{item.note}</span>
        </div>
      ))}
      {view.reviewCount > 0 ? <a className="sales-kpis__review" href="/sales?tab=review">{view.reviewCount} {view.reviewCount === 1 ? "venta" : "ventas"} por revisar →</a> : null}
    </section>
  );
}
