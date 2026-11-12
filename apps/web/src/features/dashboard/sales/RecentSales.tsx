import "./recent-sales.css";
import type { ReactNode } from "react";
import type { RecentSale } from "@contracts/DashboardContracts";
import { formatMoney } from "@shared/format/formatMoney";
import { timeAgo } from "@shared/format/timeAgo";

/**
 * Las últimas ventas con el anuncio que las trajo; arriba, descargar todas las
 * del periodo (`download`, solo para quien puede).
 */
export function RecentSales({ sales, download }: { readonly sales: ReadonlyArray<RecentSale>; readonly download?: ReactNode }) {
  return (
    <section className="recent-sales" aria-labelledby="recent-sales-title">
      <header className="recent-sales__header">
        <h2 id="recent-sales-title">Últimas ventas con su anuncio</h2>
        <div className="recent-sales__actions">
          {download}
          <a href="/sales" className="ui-link">Ver todas en Ventas →</a>
        </div>
      </header>
      {sales.length === 0 ? <p className="ui-muted recent-sales__empty">Aún no hay ventas aprobadas.</p> : (
        <div className="recent-sales__scroll">
          <table className="recent-sales__table">
            <thead>
              <tr><th scope="col">Cliente</th><th scope="col">Producto</th><th scope="col">Anuncio</th><th scope="col">Valor</th><th scope="col">Número</th></tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td><strong>{sale.customerName ?? "Sin nombre"}</strong><span>{timeAgo(sale.soldAt)}</span></td>
                  <td>{sale.productName ?? "—"}</td>
                  <td><span className={`recent-sales__ad${sale.adName ? "" : " recent-sales__ad--organic"}`}>{sale.adName ?? "Sin anuncio (orgánico)"}</span></td>
                  <td><strong>{formatMoney(sale.amount, sale.currency)}</strong></td>
                  <td>{sale.connectionName ?? "Anotada a mano"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
