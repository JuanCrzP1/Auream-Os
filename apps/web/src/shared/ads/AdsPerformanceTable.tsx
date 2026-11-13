import "./ads-performance-table.css";
import type { AdPerformanceRow, AdsDashboardResponse } from "@contracts/DashboardContracts";
import { ADVICE_LABEL, formatCop, formatCount, formatRoas, STATUS_LABEL } from "./adsFormat";

/**
 * Cada campaña, conjunto o anuncio con lo que gastó (Meta) y lo que vendió de
 * verdad (Auream), frente a lo que cree Meta, y qué hacer con cada uno. Donde
 * Auream no ve las ventas (`profit` es `null`) van rayas, no ceros. Se
 * desplaza de lado en pantallas angostas.
 */
export function AdsPerformanceTable({ data }: { readonly data: AdsDashboardResponse }) {
  const money = (value: number | null) => formatCop(value, data.currency);
  const cells = (row: Omit<AdPerformanceRow, "id" | "name" | "level" | "status" | "parentName" | "dailyBudget" | "thumbnailUrl" | "advice" | "adviceReason">) => (
    <>
      <td>{money(row.spend)}</td>
      <td>{formatCount(row.chats)}</td>
      <td>{money(row.costPerChat)}</td>
      <td><strong>{row.profit === null ? "—" : formatCount(row.sales)}</strong> <span className="ads-table__meta">/ {formatCount(row.metaPurchases)}</span></td>
      <td>{row.profit === null ? "—" : money(row.revenue)}</td>
      {row.profit === null ? <td>—</td> : (
        <td className={row.profit >= 0 ? "ads-table__good" : "ads-table__bad"}><strong>{row.profit < 0 ? "−" : ""}{money(Math.abs(row.profit))}</strong></td>
      )}
      <td><strong className={row.roas !== null && row.roas >= 3 ? "ads-table__good" : row.roas !== null && row.roas < 1 ? "ads-table__bad" : undefined}>{formatRoas(row.roas)}</strong> <span className="ads-table__meta">/ {formatRoas(row.roasMeta)}</span></td>
      <td>{money(row.costPerSale)}</td>
    </>
  );
  return (
    <div className="ads-table__scroll">
      <table className="ads-table">
        <thead>
          <tr>
            <th scope="col">Qué hacer</th>
            <th scope="col">Nombre</th>
            <th scope="col">Gasto</th>
            <th scope="col">Chats</th>
            <th scope="col">Costo / chat</th>
            <th scope="col" title="Ventas que registró Auream / compras que vio el Píxel de Meta">Ventas <span>Auream / Meta</span></th>
            <th scope="col">Facturación</th>
            <th scope="col">Ganancia</th>
            <th scope="col" title="Lo que vuelve por cada 1 gastado: con las ventas reales / según Meta">ROAS <span>Auream / Meta</span></th>
            <th scope="col">Costo / venta</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td><span className={`ads-table__advice ads-table__advice--${row.advice}`} title={row.adviceReason}>{ADVICE_LABEL[row.advice]}</span></td>
              <td>
                <span className="ads-table__name">
                  {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="ads-table__thumb" loading="lazy" /> : null}
                  <span>
                    <strong>{row.name}</strong>
                    <span className="ads-table__meta">
                      <span className={`ads-table__dot${row.status === "ACTIVE" ? " ads-table__dot--on" : ""}`} aria-hidden="true" />
                      {STATUS_LABEL[row.status] ?? row.status}
                      {row.parentName ? ` · ${row.parentName}` : ""}
                      {row.dailyBudget ? ` · ${money(row.dailyBudget)}/día` : ""}
                    </span>
                    <span className="ads-table__reason">{row.adviceReason}</span>
                  </span>
                </span>
              </td>
              {cells(row)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <th scope="row">Total</th>
            {cells(data.totals)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
