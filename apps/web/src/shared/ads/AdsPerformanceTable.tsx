import "./ads-performance-table.css";
import type { AdPerformanceRow, AdsDashboardResponse } from "@contracts/DashboardContracts";
import { ADVICE_LABEL, formatCop, formatCount, formatRoas, STATUS_LABEL } from "./adsFormat";
import { chatCoverage } from "./metaSource";

/**
 * Cada campaña, conjunto o anuncio con lo que gastó (Meta) y lo que vendió de
 * verdad (Auream), frente a lo que cree Meta, y qué hacer con cada uno. Donde
 * Auream no ve las ventas (`profit` es `null`) van rayas, no ceros. Los chats
 * dicen cuántos llegaron a Auream de los que cobró Meta: así se sabe en qué
 * campañas confiar. Se desplaza de lado en pantallas angostas.
 */
export function AdsPerformanceTable({ data }: { readonly data: AdsDashboardResponse }) {
  const money = (value: number | null) => formatCop(value, data.currency);
  const meta = (value: string) => <span className="ads-table__meta"> / {value}</span>;
  const cells = (row: Omit<AdPerformanceRow, "id" | "name" | "level" | "status" | "parentName" | "dailyBudget" | "thumbnailUrl" | "advice" | "adviceReason">) => {
    const coverage = chatCoverage(row.arrivedChats, row.chats);
    return (
    <>
      <td>{money(row.spend)}</td>
      <td>
        <strong>{formatCount(row.arrivedChats)}</strong>{meta(formatCount(row.chats))}
        {coverage ? <span className={`ads-table__coverage ads-table__coverage--${coverage.tone}`}>{coverage.text}</span> : null}
      </td>
      <td>{money(row.costPerChat)}</td>
      <td><strong>{row.profit === null ? "—" : formatCount(row.sales)}</strong>{meta(formatCount(row.metaPurchases))}</td>
      <td><strong>{row.profit === null ? "—" : money(row.revenue)}</strong>{meta(money(row.metaRevenue))}</td>
      {row.profit === null ? <td title="Necesita tus ventas reales: con lo que reporta el píxel no se calcula">—</td> : (
        <td className={row.profit >= 0 ? "ads-table__good" : "ads-table__bad"}><strong>{row.profit < 0 ? "−" : ""}{money(Math.abs(row.profit))}</strong></td>
      )}
      <td><strong className={row.roas !== null && row.roas >= 3 ? "ads-table__good" : row.roas !== null && row.roas < 1 ? "ads-table__bad" : undefined}>{formatRoas(row.roas)}</strong> <span className="ads-table__meta">/ {formatRoas(row.roasMeta)}</span></td>
      <td><strong>{money(row.costPerSale)}</strong>{meta(money(row.costPerSaleMeta))}</td>
    </>
    );
  };
  return (
    <div className="ads-table__scroll">
      <table className="ads-table">
        <thead>
          <tr>
            <th scope="col">Qué hacer</th>
            <th scope="col">Nombre</th>
            <th scope="col">Gasto</th>
            <th scope="col" title="Clientes que llegaron a Auream por el anuncio / chats que cobró Meta. Si llega menos de la mitad, Auream aún no puede juzgar la campaña">Chats <span>Auream / Meta</span></th>
            <th scope="col">Costo / chat</th>
            <th scope="col" title="Ventas anotadas en Auream / compras que vio el Píxel de Meta">Ventas <span>Auream / Meta</span></th>
            <th scope="col" title="Lo que vendieron: con tus ventas reales / lo que reporta el Píxel de Meta">Facturación <span>Auream / Meta</span></th>
            <th scope="col" title="Facturación real − gasto. Solo con tus ventas reales: con lo que reporta el píxel engaña">Ganancia</th>
            <th scope="col" title="Lo que vuelve por cada 1 gastado: con las ventas reales / según Meta">ROAS <span>Auream / Meta</span></th>
            <th scope="col" title="Gasto ÷ ventas: con tus ventas reales / con las compras que reporta Meta (su «Coste por resultado»)">Costo / venta <span>Auream / Meta</span></th>
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
