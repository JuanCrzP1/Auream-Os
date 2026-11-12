import "./ads-hero.css";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { money, trendText } from "../dashboardFormat";

/**
 * La franja principal: el ROAS real (con las ventas que sí trajo cada anuncio)
 * frente al que cree Meta, y la plata de los anuncios: facturación, gasto,
 * ganancia, costo por venta, por chat y cuánto deja cada chat.
 */
export function AdsHero({ view, periodWords }: { readonly view: SalesDashboardResponse; readonly periodWords: string }) {
  const ads = view.ads!;
  const c = view.currency;
  const roasMoney = ads.roas === null ? null : ads.roas.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cards: ReadonlyArray<{ label: string; value: string; note: string; tone?: "profit" }> = [
    { label: "Facturación por anuncios", value: money(ads.revenue.value, c), note: trendText(ads.revenue)?.text ?? `${ads.attributedSales} ventas` },
    { label: "Gasto en Meta", value: money(ads.spend.value, c), note: `${trendText(ads.spend, "down")?.text ?? ""} · ${ads.activeCampaigns} ${ads.activeCampaigns === 1 ? "campaña activa" : "campañas activas"}`.replace(/^ · /, "") },
    { label: view.realProfit !== null ? "Ganancia real" : "Ganancia (ventas − anuncios)", value: money(view.realProfit ?? ads.profit.value, c), note: view.realProfit !== null ? "ventas − anuncios − costo de productos" : (trendText(ads.profit)?.text ?? "frente al periodo anterior"), tone: "profit" },
    { label: "Costo por venta", value: money(ads.costPerSale, c), note: `${ads.attributedSales} ventas por anuncio` },
    { label: "Costo por chat", value: money(ads.costPerChat, c), note: `${ads.chats.toLocaleString("es-CO")} chats por anuncio` },
    { label: "Cada chat de anuncio deja", value: money(ads.revenuePerChat, c), note: "en ventas, en promedio" }
  ];
  return (
    <section className="ads-hero" aria-label="La plata de tus anuncios">
      <div className="ads-hero__lead">
        <span className="ads-hero__label">ROAS real · {periodWords}</span>
        <span className="ads-hero__roas">{formatRoas(ads.roas)}</span>
        <span className="ads-hero__sentence">
          {roasMoney ? <>Por cada <strong>$ 1</strong> en anuncios te vuelven <strong>$ {roasMoney}</strong> en ventas reales.</> : "Aún no hay gasto en este periodo."}
        </span>
        <span className="ads-hero__meta">Meta dice {formatRoas(ads.roasMeta)}: no ve las compras que pasan en WhatsApp</span>
      </div>
      <div className="ads-hero__grid">
        {cards.map((card) => (
          <div key={card.label} className={`ads-hero__card${card.tone ? " ads-hero__card--profit" : ""}`}>
            <span className="ads-hero__card-label">{card.label}</span>
            <strong className="ads-hero__card-value">{card.value}</strong>
            <span className="ads-hero__card-note">{card.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
