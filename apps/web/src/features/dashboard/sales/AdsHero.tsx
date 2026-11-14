import "./ads-hero.css";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { salesUnknown } from "@contracts/AdMeasurementContracts";
import { formatRoas } from "@shared/ads/adsFormat";
import { measurementSentence } from "@shared/ads/measurementText";
import { MetaTag } from "@shared/ads/MetaTag";
import { META_REPORTS, metaBeside, perUnit, purchasesText, WAITS_FOR_AD_SALES } from "@shared/ads/metaSource";
import { money, trendText } from "../dashboardFormat";

interface HeroCard {
  readonly label: string;
  readonly value: string;
  readonly note: string;
  readonly tone?: "profit";
  /** El número lo reporta Meta (lleva la etiqueta «Meta»). */
  readonly meta?: true;
}

/**
 * La franja principal: el ROAS real (con las ventas que sí trajo cada anuncio)
 * y la plata de los anuncios: facturación, gasto, ganancia, costo por venta,
 * por chat y cuánto deja cada chat. Con ventas de los anuncios en Auream, los
 * números son de Auream y Meta va al lado; sin ellas, va lo que reporta Meta
 * con su etiqueta y la ganancia espera (nunca en 0 ni en pérdida).
 */
export function AdsHero({ view, periodWords }: { readonly view: SalesDashboardResponse; readonly periodWords: string }) {
  const ads = view.ads!;
  const c = view.currency;
  const blind = salesUnknown(ads.measurement, ads.attributedSales);
  const partial = measurementSentence(ads.measurement);
  const profit = blind ? null : view.realProfit ?? ads.profit.value;
  const spend: HeroCard = { label: "Gasto en Meta", value: money(ads.spend.value, c), note: `${trendText(ads.spend, "down")?.text ?? ""} · ${ads.activeCampaigns} ${ads.activeCampaigns === 1 ? "campaña activa" : "campañas activas"}`.replace(/^ · /, "") };
  const perChat: HeroCard = { label: "Costo por chat", value: money(ads.costPerChat, c), note: `${ads.chats.toLocaleString("es-CO")} chats por anuncio` };
  const profitCard: HeroCard = {
    label: view.realProfit !== null && !blind ? "Ganancia real" : "Ganancia (ventas − anuncios)",
    value: money(profit, c),
    note: blind ? WAITS_FOR_AD_SALES : view.realProfit !== null ? "ventas − anuncios − costo de productos" : (trendText(ads.profit)?.text ?? "frente al periodo anterior"),
    tone: "profit"
  };
  const metaPerChat = perUnit(ads.metaRevenue, ads.chats);
  const cards: ReadonlyArray<HeroCard> = blind
    ? [
        { label: "Facturación por anuncios", value: money(ads.metaRevenue, c), note: META_REPORTS, meta: true },
        spend,
        profitCard,
        ads.costPerSaleMeta === null
          ? { label: "Costo por venta", value: "—", note: WAITS_FOR_AD_SALES }
          : { label: "Costo por venta", value: money(ads.costPerSaleMeta, c), note: `${purchasesText(ads.metaPurchases)} que vio Meta`, meta: true },
        perChat,
        metaPerChat === null
          ? { label: "Cada chat de anuncio deja", value: "—", note: WAITS_FOR_AD_SALES }
          : { label: "Cada chat de anuncio deja", value: money(metaPerChat, c), note: "en compras que vio Meta", meta: true }
      ]
    : [
        { label: "Facturación por anuncios", value: money(ads.revenue.value, c), note: [trendText(ads.revenue)?.text ?? `${ads.attributedSales} ventas`, metaBeside(money(ads.metaRevenue, c))].join(" · ") },
        spend,
        profitCard,
        { label: "Costo por venta", value: money(ads.costPerSale, c), note: [`${ads.attributedSales} ventas por anuncio`, ads.costPerSaleMeta !== null ? metaBeside(money(ads.costPerSaleMeta, c)) : null].filter(Boolean).join(" · ") },
        perChat,
        { label: "Cada chat de anuncio deja", value: money(ads.revenuePerChat, c), note: ["en ventas, en promedio", metaPerChat !== null ? metaBeside(money(metaPerChat, c)) : null].filter(Boolean).join(" · ") }
      ];
  const roasMoney = (value: number | null) => (value === null ? null : value.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const real = roasMoney(ads.roas);
  const reported = roasMoney(ads.roasMeta);

  return (
    <section className="ads-hero" aria-label="La plata de tus anuncios">
      <div className="ads-hero__lead">
        <span className="ads-hero__label">{blind ? "ROAS" : "ROAS real"} · {periodWords}{blind && reported ? <> <MetaTag tone="dark" /></> : null}</span>
        <span className="ads-hero__roas">{formatRoas(blind ? ads.roasMeta : ads.roas)}</span>
        <span className="ads-hero__sentence">
          {blind
            ? reported ? <>Por cada <strong>$ 1</strong> en anuncios, Meta reporta <strong>$ {reported}</strong> en compras.</> : "Aún no hay gasto en este periodo."
            : real ? <>Por cada <strong>$ 1</strong> en anuncios te vuelven <strong>$ {real}</strong> en ventas reales.</> : "Aún no hay gasto en este periodo."}
        </span>
        <span className="ads-hero__meta">{blind ? `ROAS real: ${WAITS_FOR_AD_SALES.charAt(0).toLowerCase()}${WAITS_FOR_AD_SALES.slice(1)}` : partial ?? `${metaBeside(formatRoas(ads.roasMeta))}: no ve las compras que pasan en WhatsApp`}</span>
      </div>
      <div className="ads-hero__grid">
        {cards.map((card) => (
          <div key={card.label} className={`ads-hero__card${card.tone ? " ads-hero__card--profit" : ""}`}>
            <span className="ads-hero__card-label">{card.label}{card.meta ? <> <MetaTag tone="dark" /></> : null}</span>
            <strong className="ads-hero__card-value">{card.value}</strong>
            <span className="ads-hero__card-note">{card.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
