import "./breakdowns.css";
import type { Breakdown, SalesDashboardResponse } from "@contracts/DashboardContracts";
import { findCountry } from "@contracts/Countries";
import { money } from "../dashboardFormat";

const PEAK_HOURS = (hours: ReadonlyArray<number>) => {
  const top = hours.indexOf(Math.max(...hours));
  return top >= 0 && hours[top]! > 0 ? `${top % 12 || 12}${top < 12 ? " a. m." : " p. m."}` : null;
};

function Bars({ title, rows, currency, label }: { readonly title: string; readonly rows: ReadonlyArray<Breakdown>; readonly currency: string; readonly label?: (row: Breakdown) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.revenue));
  return (
    <section className="breakdowns__card" aria-label={title}>
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="ui-muted">Sin ventas en este periodo.</p> : null}
      {rows.map((row) => (
        <div key={row.key} className="breakdowns__row">
          <span className="breakdowns__line"><strong>{label ? label(row) : row.label}</strong><span>{money(row.revenue, currency)} · {row.sales} ventas</span></span>
          <span className="breakdowns__track"><span style={{ width: `${(row.revenue / max) * 100}%` }} /></span>
        </div>
      ))}
    </section>
  );
}

/** Ventas por hora (con la hora pico) y por número, producto y país. */
export function Breakdowns({ view }: { readonly view: SalesDashboardResponse }) {
  const maxHour = Math.max(1, ...view.byHour);
  const peak = PEAK_HOURS(view.byHour);
  return (
    <div className="breakdowns">
      <section className="breakdowns__card breakdowns__card--hours" aria-label="Ventas por hora">
        <h2>Ventas por hora</h2>
        <span className="ui-muted breakdowns__hint">{peak ? <>Más ventas cerca de las <strong>{peak}</strong>: ten el bot y los asesores listos a esa hora.</> : "Aún sin ventas en este periodo."}</span>
        <div className="breakdowns__hours" aria-hidden="true">
          {view.byHour.map((count, hour) => <span key={hour} title={`${hour} h: ${count}`} className={count === Math.max(...view.byHour) && count > 0 ? "breakdowns__hour--peak" : undefined} style={{ height: `${Math.max(3, (count / maxHour) * 100)}%` }} />)}
        </div>
        <div className="breakdowns__hours-axis"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
      </section>
      <Bars title="Por número" rows={view.byConnection} currency={view.currency} />
      <Bars title="Por producto" rows={view.byProduct} currency={view.currency} />
      <Bars title="Por país" rows={view.byCountry} currency={view.currency} label={(row) => (row.key === "--" ? "Sin país" : `${findCountry(row.key).flag} ${findCountry(row.key).name}`)} />
    </div>
  );
}
