import { BUSINESS_DATA_TYPE_LABEL, businessValueText, type BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { TypeChip } from "@shared/contact-fields/TypeChip";
import { usesSummary } from "../businessDataText";

/** Cada dato con su clave, su valor de hoy, su tipo y dónde se usa. Toda la fila abre su detalle. */
export function DataTable({ data, onOpen }: { readonly data: ReadonlyArray<BusinessDatumSummary>; readonly onOpen: (datum: BusinessDatumSummary) => void }) {
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
            const value = businessValueText(datum);
            return (
              <li key={datum.id}>
                <button type="button" className="bd-row" aria-label={`${datum.label} · ${BUSINESS_DATA_TYPE_LABEL[datum.type]} · ${uses.text}`} onClick={() => onOpen(datum)}>
                  <span className="bd-row__name">
                    <strong>{datum.label}</strong>
                    <code>{`{${datum.key}}`}</code>
                  </span>
                  <span className="bd-row__value" title={value}>{value}</span>
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
