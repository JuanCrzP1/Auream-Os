import "./sales-table.css";
import type { SaleSummary } from "@contracts/SalesContracts";
import { findCountry } from "@contracts/Countries";
import { formatMoney, formatSoldAt } from "../salesFormat";
import { SaleStatusChip } from "./SaleStatusChip";
import { avatarTone, initials, saleOrigin } from "./saleOrigin";

/**
 * Las ventas, la más reciente primero: el cliente (con su inicial, cuándo, su
 * país y de dónde vino), el producto, el monto y el estado. Tocar una fila la
 * abre para ver el detalle o revisarla.
 */
export function SalesTable({ sales, onOpen }: { readonly sales: ReadonlyArray<SaleSummary>; readonly onOpen: (sale: SaleSummary) => void }) {
  return (
    <ul className="sales-table" aria-label="Ventas">
      {sales.map((sale) => (
        <li key={sale.id}>
          <button type="button" className="sales-row" onClick={() => onOpen(sale)} aria-label={`Venta de ${sale.customerName ?? sale.customerPhone ?? "cliente sin nombre"}, ${formatSoldAt(sale.soldAt)}`}>
            <span className="sales-row__who">
              <span className={`sales-row__avatar sales-row__avatar--${avatarTone(sale)}`} aria-hidden="true">
                {initials(sale)}
              </span>
              <span className="sales-row__text">
                <span className="sales-row__name">{sale.customerName ?? (sale.customerPhone ? `+${sale.customerPhone}` : "Sin nombre")}</span>
                <span className="sales-row__meta">
                  {formatSoldAt(sale.soldAt)}
                  {sale.country ? ` · ${findCountry(sale.country).flag}` : ""} · {saleOrigin(sale)}
                </span>
              </span>
            </span>
            <span className="sales-row__product">{sale.productName ?? <em className="sales-row__missing">Sin producto</em>}</span>
            <span className="sales-row__amount">
              {sale.amount !== null && sale.currency ? formatMoney(sale.amount, sale.currency) : <em className="sales-row__missing">{sale.reviewReason ?? "Sin monto"}</em>}
            </span>
            <span className="sales-row__status">
              <SaleStatusChip status={sale.status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
