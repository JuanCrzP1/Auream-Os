import "./sales-summary.css";
import { useState } from "react";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import type { InvestmentMode } from "./investmentCard";
import { SummaryIcon } from "./SummaryIcon";
import { summaryCards, type SummaryCard, type SummaryTrend } from "./summaryCards";

/**
 * El resumen del periodo: facturación, ventas, compra promedio y ganancia;
 * leads nuevos, conversión, ROAS real e inversión (Meta, otros gastos o
 * todo). Cada uno con su cambio frente al periodo anterior. Qué dice cada
 * tarjeta lo decide `summaryCards` (puro); aquí solo se pinta.
 */
export function SalesSummary({ view, onOpenExpenses }: {
  readonly view: SalesDashboardResponse;
  /** Abre «Otros gastos» (sin esto, la tarjeta no lleva el enlace). */
  readonly onOpenExpenses?: () => void;
}) {
  const [investment, setInvestment] = useState<InvestmentMode>("all");
  const cards = summaryCards(view, investment);
  return (
    <section className="sales-summary" aria-label="Resumen del periodo">
      <div className="sales-summary__grid">
        {cards.map((card) => (
          <SummaryCardView key={card.id} card={card} onMode={setInvestment} onAction={onOpenExpenses} />
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

function TrendChip({ trend }: { readonly trend: SummaryTrend }) {
  return (
    <span className={`sales-summary__chip sales-summary__chip--${trend.tone}`} title="Frente al periodo anterior">
      {trend.text}
    </span>
  );
}

function SummaryCardView({ card, onMode, onAction }: {
  readonly card: SummaryCard;
  readonly onMode: (mode: InvestmentMode) => void;
  readonly onAction: (() => void) | undefined;
}) {
  // Con selector arriba, el cambio va junto al número.
  const chipBeside = Boolean(card.modes);
  return (
    <article className="sales-summary__card" aria-label={card.label}>
      <span className={chipBeside ? "sales-summary__top sales-summary__top--modes" : "sales-summary__top"}>
        <span className="sales-summary__icon">
          <SummaryIcon name={card.icon} />
        </span>
        <span className="sales-summary__label">{card.label}</span>
        {card.modes ? (
          <span className="sales-summary__modes" role="group" aria-label="Qué inversión ver">
            {card.modes.options.map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={card.modes!.current === mode} onClick={() => onMode(mode)}>{label}</button>
            ))}
          </span>
        ) : card.trend ? <TrendChip trend={card.trend} /> : null}
      </span>
      <span className="sales-summary__value-row">
        <span className="sales-summary__value">{card.value}</span>
        {chipBeside && card.trend ? <TrendChip trend={card.trend} /> : null}
      </span>
      <span className="sales-summary__note">
        {card.note}
        {card.action && onAction ? (
          <>
            {" · "}
            <button type="button" className="sales-summary__action" onClick={onAction}>{card.action.label}</button>
          </>
        ) : null}
      </span>
    </article>
  );
}
