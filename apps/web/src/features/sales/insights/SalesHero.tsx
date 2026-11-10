import "./sales-hero.css";
import type { CurrencyInsight, CurrencySeries } from "@contracts/SalesInsightsContracts";
import { currencyName, formatMoney } from "../salesFormat";
import { SalesChart } from "./SalesChart";
import { TrendChip } from "./TrendChip";

/**
 * La portada: lo vendido en la moneda principal, cómo va frente al periodo
 * anterior, cuántas ventas y el ticket promedio, y la curva por día.
 */
export function SalesHero({ insight, series, periodLabel }: { readonly insight: CurrencyInsight | null; readonly series: CurrencySeries | undefined; readonly periodLabel: string }) {
  if (!insight) {
    return (
      <section className="sales-hero sales-hero--empty" aria-label="Lo vendido en el periodo">
        <div className="sales-hero__numbers">
          <span className="sales-hero__label">Vendido · {periodLabel}</span>
          <span className="sales-hero__amount">$ 0</span>
          <span className="sales-hero__meta">Todavía no hay ventas aprobadas en este periodo. Cuando tus flujos registren ventas, aquí verás cómo vas.</span>
        </div>
      </section>
    );
  }
  const [integer, decimals] = formatMoney(insight.amount, insight.currency).replace(` ${insight.currency}`, "").split(",");
  return (
    <section className="sales-hero" aria-label="Lo vendido en el periodo">
      <div className="sales-hero__numbers">
        <span className="sales-hero__label">Vendido · {periodLabel}</span>
        <span className="sales-hero__amount" title={currencyName(insight.currency)}>
          {integer}
          {decimals ? <span className="sales-hero__decimals">,{decimals}</span> : null}
          <span className="sales-hero__currency"> {insight.currency}</span>
        </span>
        <TrendChip change={insight.change} suffix="frente al periodo anterior" />
        <span className="sales-hero__meta">
          {insight.count === 1 ? "1 venta" : `${insight.count} ventas`} · ticket promedio {formatMoney(insight.average, insight.currency)}
        </span>
      </div>
      {series && series.points.length > 1 ? <SalesChart points={series.points} currency={insight.currency} /> : null}
    </section>
  );
}
