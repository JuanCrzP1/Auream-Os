import "./sales-table.css";
import type { SaleSummary } from "@contracts/SalesContracts";
import { SalesIcons } from "../salesIcons";
import { SALE_SOURCE_LABEL, countryLabel, formatMoney, formatSoldAt } from "../salesFormat";
import { SaleStatusChip } from "./SaleStatusChip";

/**
 * Las ventas, la más reciente primero: cuándo, quién, qué, cuánto, de dónde
 * vino y su estado. Tocar una fila la abre (ver, corregir, aprobar o anular).
 */
export function SalesTable({ sales, onOpen }: { readonly sales: ReadonlyArray<SaleSummary>; readonly onOpen: (sale: SaleSummary) => void }) {
  return (
    <div className="sales-table">
      <div className="sales-table__head" aria-hidden="true">
        <span>Fecha</span>
        <span>Cliente</span>
        <span>Producto</span>
        <span>Monto</span>
        <span>Origen</span>
        <span>Estado</span>
      </div>
      <ul className="sales-table__rows" aria-label="Ventas">
        {sales.map((sale) => (
          <li key={sale.id}>
            <button type="button" className="sales-row" onClick={() => onOpen(sale)} aria-label={`Venta de ${sale.customerName ?? sale.customerPhone ?? "cliente sin nombre"}, ${formatSoldAt(sale.soldAt)}`}>
              <span className="sales-row__date">{formatSoldAt(sale.soldAt)}</span>
              <span className="sales-row__who">
                <span className="sales-row__name">{sale.customerName ?? "Sin nombre"}</span>
                <span className="sales-row__meta">{[sale.customerPhone ? `+${sale.customerPhone}` : null, countryLabel(sale.country)].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="sales-row__product">{sale.productName ?? <em className="sales-row__missing">Sin producto</em>}</span>
              <span className="sales-row__amount">{sale.amount !== null && sale.currency ? formatMoney(sale.amount, sale.currency) : <em className="sales-row__missing">Sin monto</em>}</span>
              <span className="sales-row__source">
                <span className="sales-row__source-icon">{sale.source === "manual" ? SalesIcons.user : SalesIcons.flow}</span>
                <span className="sales-row__source-text">
                  {SALE_SOURCE_LABEL[sale.source]}
                  {sale.flowName || sale.connectionName ? <span className="sales-row__meta">{sale.flowName ?? sale.connectionName}</span> : null}
                </span>
              </span>
              <span className="sales-row__status">
                <SaleStatusChip status={sale.status} />
                {sale.status === "review" && sale.reviewReason ? <span className="sales-row__reason">{sale.reviewReason}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
