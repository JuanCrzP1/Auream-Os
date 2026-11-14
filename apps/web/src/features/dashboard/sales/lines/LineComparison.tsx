import "./line-comparison.css";
import type { LineComparisonResponse, LineComparisonRow } from "@contracts/LineComparisonContracts";
import { MetaTag } from "@shared/ads/MetaTag";
import { dashboardApi } from "../../services/dashboardApi";
import { useDashboardData } from "../../useDashboardData";
import { MONEY_COLUMNS, SALES_COLUMNS, verdict, type Cell, type Column } from "./lineCells";

/**
 * Comparar líneas: una fila por línea de venta con su plata en el mismo
 * periodo y moneda (de la que más gana a la que menos) y todo el negocio al
 * final. Tocar una línea la elige en todo el Dashboard. Sin líneas no se ve.
 */
export function LineComparison({ range, currency, periodWords, version, onSelectLine }: {
  readonly range: { readonly from?: string; readonly to?: string };
  readonly currency?: string;
  readonly periodWords: string;
  /** Cambia al guardar un gasto (vuelve a pedir). */
  readonly version: number;
  readonly onSelectLine: (lineId: string) => void;
}) {
  const filters = { ...range, ...(currency ? { currency } : {}) };
  const { data } = useDashboardData<LineComparisonResponse>(() => dashboardApi.lines(filters), `${JSON.stringify(filters)}#${version}`);
  if (!data || data.rows.length === 0) return null;

  const columns = data.canSeeAds ? MONEY_COLUMNS : SALES_COLUMNS;
  const sentence = verdict(data.rows, data.canSeeAds, data.currency);
  const withoutCampaigns = data.canSeeAds && data.rows.some((row) => !row.hasCampaigns);
  const unmeasured = data.rows.some((row) => row.salesUnknown) || Boolean(data.total.salesUnknown);

  return (
    <section className="line-comparison" aria-labelledby="line-comparison-title">
      <header className="line-comparison__header">
        <div>
          <h2 id="line-comparison-title">Comparar líneas</h2>
          <p className="ui-muted">{sentence ?? `Cómo va cada parte de tu negocio, ${periodWords}.`}</p>
        </div>
        <span className="line-comparison__currency">{data.currency}</span>
      </header>
      <div className="line-comparison__scroll">
        <table className="line-comparison__table">
          <thead>
            <tr>
              <th scope="col">Línea</th>
              {columns.map((column) => <th key={column.id} scope="col">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => <LineRow key={row.id} row={row} columns={columns} currency={data.currency} onSelect={() => onSelectLine(row.id!)} />)}
          </tbody>
          <tfoot>
            <LineRow row={data.total} columns={columns} currency={data.currency} />
          </tfoot>
        </table>
      </div>
      {unmeasured || withoutCampaigns || data.overlapping || data.missingRates.length > 0 ? (
        <ul className="line-comparison__notes">
          {unmeasured ? <li>Las líneas con «Meta» aún no tienen ventas de sus anuncios en Auream: su ROAS es el que reporta Meta, y su ganancia y su margen se calculan cuando vendan en Auream.</li> : null}
          {withoutCampaigns ? <li>Una línea «Sin campañas» no resta gasto en Meta de su ganancia: ponle sus campañas para verla completa.</li> : null}
          {data.overlapping ? <li>Algunas líneas comparten productos o campañas, así que sumadas pasan del total del negocio.</li> : null}
          {data.missingRates.length > 0 ? <li>Sin tasa de cambio para {data.missingRates.join(", ")}: esos montos no se sumaron.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

function LineRow({ row, columns, currency, onSelect }: {
  readonly row: LineComparisonRow;
  readonly columns: ReadonlyArray<Column>;
  readonly currency: string;
  readonly onSelect?: () => void;
}) {
  const share = row.share === null ? null : Math.round(row.share * 100);
  return (
    <tr className={onSelect ? "line-comparison__row" : "line-comparison__row line-comparison__row--total"}>
      <th scope="row">
        {onSelect ? (
          <button type="button" className="line-comparison__name" onClick={onSelect} aria-label={`Ver la línea ${row.name}`}>
            <span className="line-comparison__dot" style={{ background: row.color ?? "var(--primary)" }} aria-hidden="true" />
            <span>
              <strong>{row.name}</strong>
              {share !== null ? (
                <span className="line-comparison__share">
                  <span className="line-comparison__bar" aria-hidden="true"><i style={{ width: `${share}%`, background: row.color ?? "var(--primary)" }} /></span>
                  {share === 0 && row.revenue.value > 0 ? "< 1" : share} % de lo vendido
                </span>
              ) : null}
            </span>
            <span className="line-comparison__go" aria-hidden="true">→</span>
          </button>
        ) : <strong>{row.name}</strong>}
      </th>
      {columns.map((column) => <CellView key={column.id} label={column.label} cell={column.cell(row, currency)} />)}
    </tr>
  );
}

function CellView({ label, cell }: { readonly label: string; readonly cell: Cell }) {
  return (
    <td data-label={label} title={cell.hint} className={cell.tone ? `is-${cell.tone}` : undefined}>
      <span className="line-comparison__value">{cell.text}{cell.source === "meta" ? <> <MetaTag /></> : null}</span>
      {cell.trend ? <span className={`line-comparison__trend is-${cell.trend.tone}`}>{cell.trend.text}</span> : null}
      {cell.beside ? <span className="line-comparison__beside">{cell.beside}</span> : null}
    </td>
  );
}
