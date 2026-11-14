import { BUSINESS_DATA_TYPE_LABEL, businessValueText, type BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { valueAt } from "@contracts/BusinessDataTimeline";
import { TypeChip } from "@shared/contact-fields/TypeChip";
import { usesSummary } from "../businessDataText";
import { rowBadge } from "../schedules/scheduleText";

const CLOCK = <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

/**
 * Cada dato con su clave, el valor que reciben tus clientes AHORA (el de un
 * cambio programado mientras rige, con el de siempre debajo), su tipo y dónde
 * se usa. Toda la fila abre su detalle.
 */
export function DataTable({
  data,
  timeZone,
  now,
  onOpen
}: {
  readonly data: ReadonlyArray<BusinessDatumSummary>;
  readonly timeZone: string;
  readonly now: Date;
  readonly onOpen: (datum: BusinessDatumSummary) => void;
}) {
  return (
    <section className="bd-card" aria-label="Tus datos">
      <div className="bd-card__head">
        <h2>Tus datos <span>{data.length}</span></h2>
        <p>Se escriben con su clave en flujos, difusiones y respuestas rápidas. Los flujos los leen; solo se cambian aquí.</p>
      </div>
      <div className="bd-table">
        <div className="bd-table__head" aria-hidden="true">
          <span>Dato</span>
          <span>Valor</span>
          <span>Tipo</span>
          <span>Dónde se usa</span>
          <span />
        </div>
        <ul className="bd-table__rows">
          {data.map((datum) => {
            const uses = usesSummary(datum.uses);
            const value = businessValueText({ type: datum.type, value: valueAt(datum, now) });
            const badge = rowBadge(datum.schedules, timeZone, now);
            return (
              <li key={datum.id}>
                <button type="button" className="bd-row" aria-label={`${datum.label} · ${BUSINESS_DATA_TYPE_LABEL[datum.type]} · ${uses.text}${badge ? ` · ${badge.text}` : ""}`} onClick={() => onOpen(datum)}>
                  <span className="bd-row__name">
                    <strong>{datum.label}</strong>
                    <code>{`{${datum.key}}`}</code>
                  </span>
                  <span className="bd-row__value">
                    <span className="bd-row__now" title={value}>{value}</span>
                    {badge ? (
                      <span className={`bd-badge bd-badge--${badge.tone}`}>
                        {badge.tone === "now" ? <i aria-hidden="true" /> : CLOCK}
                        {badge.text}
                      </span>
                    ) : null}
                    {badge?.tone === "now" ? <span className="bd-row__usual">Siempre: {businessValueText(datum)}</span> : null}
                  </span>
                  <span><TypeChip type={datum.type} /></span>
                  <span className={`bd-row__uses${uses.idle ? " is-idle" : ""}`}>{uses.text}</span>
                  <span className="bd-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
