import "./sales-summary.css";
import type { SalesTotal } from "@contracts/SalesContracts";
import { currencyName, formatMoney } from "../salesFormat";

/**
 * Lo vendido en el periodo, UNA tarjeta por moneda (pesos y dólares nunca se
 * suman): total, cuántas ventas y el ticket promedio. Solo ventas aprobadas.
 */
export function SalesSummary({ totals }: { readonly totals: ReadonlyArray<SalesTotal> }) {
  if (totals.length === 0) {
    return <p className="sales-summary__empty">Todavía no hay ventas aprobadas en este periodo.</p>;
  }
  return (
    <ul className="sales-summary" aria-label="Totales del periodo">
      {totals.map((total) => (
        <li key={total.currency} className="sales-summary__card">
          <span className="sales-summary__label">Vendido en {currencyName(total.currency)}</span>
          <strong className="sales-summary__amount">{formatMoney(total.amount, total.currency)}</strong>
          <span className="sales-summary__meta">
            {total.count === 1 ? "1 venta" : `${total.count} ventas`} · ticket promedio {formatMoney(Math.round((total.amount / total.count) * 100) / 100, total.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
