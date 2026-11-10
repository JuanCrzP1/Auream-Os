import "./currency-card.css";
import type { CurrencyInsight, CurrencySeries } from "@contracts/SalesInsightsContracts";
import { currencyName, formatMoney } from "../salesFormat";
import { chartPath } from "./chartPath";
import { TrendChip } from "./TrendChip";

/** Otra moneda del periodo: lo vendido, cuántas ventas, su promedio, su tendencia y una mini línea. */
export function CurrencyCard({ insight, series }: { readonly insight: CurrencyInsight; readonly series: CurrencySeries | undefined }) {
  const tone = insight.change !== null && insight.change < 0 ? "down" : "up";
  const geometry = series ? chartPath(series.points.map((point) => point.amount), 200, 36, 4) : null;
  return (
    <article className="currency-card" aria-label={`Vendido en ${currencyName(insight.currency)}`}>
      <span className="currency-card__label">
        {currencyName(insight.currency)} · {insight.currency}
      </span>
      <span className="currency-card__amount">{formatMoney(insight.amount, insight.currency).replace(` ${insight.currency}`, "")}</span>
      <span className="currency-card__meta">
        {insight.count === 1 ? "1 venta" : `${insight.count} ventas`} · {formatMoney(insight.average, insight.currency).replace(` ${insight.currency}`, "")} c/u
        <TrendChip change={insight.change} compact />
      </span>
      {geometry && geometry.line ? (
        <svg className={`currency-card__spark currency-card__spark--${tone}`} viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true">
          <path d={geometry.line} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
    </article>
  );
}
