import "./sales-summary.css";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { SummaryIcon } from "./SummaryIcon";
import { summaryCards, type SummaryCard } from "./summaryCards";

/**
 * El resumen del periodo: facturación, ventas, compra promedio y ganancia;
 * leads nuevos, conversión, ROAS real e inversión en Meta. Cada uno con su
 * cambio frente al periodo anterior. Qué dice cada tarjeta lo decide
 * `summaryCards` (puro); aquí solo se pinta.
 */
export function SalesSummary({ view }: { readonly view: SalesDashboardResponse }) {
  const cards = summaryCards(view);
  return (
    <section className="sales-summary" aria-label="Resumen del periodo">
      <div className="sales-summary__grid">
        {cards.map((card) => (
          <SummaryCardView key={card.id} card={card} />
        ))}
      </div>
      {view.reviewCount > 0 ? (
        <a className="sales-summary__review" href="/sales?tab=review">
          {view.reviewCount} {view.reviewCount === 1 ? "venta" : "ventas"} por revisar →
        </a>
      ) : null}
    </section>
  );
}

function SummaryCardView({ card }: { readonly card: SummaryCard }) {
  return (
    <article className="sales-summary__card" aria-label={card.label}>
      <span className="sales-summary__top">
        <span className="sales-summary__icon">
          <SummaryIcon name={card.icon} />
        </span>
        <span className="sales-summary__label">{card.label}</span>
        {card.trend ? (
          <span className={`sales-summary__chip sales-summary__chip--${card.trend.tone}`} title="Frente al periodo anterior">
            {card.trend.text}
          </span>
        ) : null}
      </span>
      <span className="sales-summary__value">{card.value}</span>
      <span className="sales-summary__note">{card.note}</span>
    </article>
  );
}
