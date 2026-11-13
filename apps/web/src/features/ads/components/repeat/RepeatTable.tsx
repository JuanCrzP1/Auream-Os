import type { AdRepeatMetrics, AdsRepeatResponse } from "@contracts/AdsRepeatContracts";
import { formatCop, formatCount, formatRoas, STATUS_LABEL } from "@shared/ads/adsFormat";

/**
 * «Con recompras»: por campaña, conjunto o anuncio, los clientes nuevos que
 * trajo, su primera compra (ROAS de nuevos) y lo que volvieron a comprar en la
 * ventana (ROAS a N días). ▲ marca a los que mejoran mucho con las recompras.
 * Se desplaza de lado en pantallas angostas, como la tabla de rendimiento.
 */
export function RepeatTable({ data }: { readonly data: AdsRepeatResponse }) {
  const money = (value: number) => formatCop(value, data.currency);
  const cells = (row: AdRepeatMetrics, lifted = false) => (
    <>
      <td>{money(row.spend)}</td>
      <td>{formatCount(row.newCustomers)}</td>
      <td>{money(row.firstRevenue)} <span className="ads-table__meta">{formatRoas(row.newRoas)}</span></td>
      <td>
        {row.repeatRevenue > 0 ? money(row.repeatRevenue) : "—"}
        {row.repeatCustomers > 0 ? <span className="ads-table__meta"> · {formatCount(row.repeatCustomers)} {row.repeatCustomers === 1 ? "cliente" : "clientes"}</span> : null}
      </td>
      <td>
        <strong className={row.windowRoas !== null && row.windowRoas >= 3 ? "ads-table__good" : row.windowRoas !== null && row.windowRoas < 1 ? "ads-table__bad" : undefined}>
          {formatRoas(row.windowRoas)}
        </strong>
        {lifted ? <span className="repeat-lift" title="Mejora mucho con las recompras: no lo apagues solo por su primera venta"> ▲</span> : null}
      </td>
    </>
  );

  return (
    <div className="ads-table__scroll">
      <table className="ads-table repeat-table">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Gasto</th>
            <th scope="col" title="Personas cuya primera compra vino de aquí en el periodo">Clientes nuevos</th>
            <th scope="col" title="Lo que pagaron en su primera compra · ROAS de nuevos">1.ª compra <span>ROAS de nuevos</span></th>
            <th scope="col" title={`Lo que esos clientes volvieron a comprar en ${data.window} días, con o sin anuncio`}>Recompras <span>{data.window} días</span></th>
            <th scope="col" title="(1.ª compra + recompras) ÷ gasto">ROAS a {data.window} días</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="ads-table__name">
                  {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" className="ads-table__thumb" loading="lazy" /> : null}
                  <span>
                    <strong>{row.name}</strong>
                    <span className="ads-table__meta">
                      <span className={`ads-table__dot${row.status === "ACTIVE" ? " ads-table__dot--on" : ""}`} aria-hidden="true" />
                      {STATUS_LABEL[row.status] ?? row.status}
                      {row.parentName ? ` · ${row.parentName}` : ""}
                    </span>
                  </span>
                </span>
              </td>
              {cells(row, row.lifted)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {cells(data.totals)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
