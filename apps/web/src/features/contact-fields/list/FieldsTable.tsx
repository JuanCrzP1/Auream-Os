import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { typeLabel } from "@shared/contact-fields/fieldTypes";
import { TypeChip } from "@shared/contact-fields/TypeChip";
import { filledPercent, usesSummary } from "../fieldText";

/** «Tuyos»: cada campo con su tipo, qué tan lleno está y quién lo usa. Toda la fila abre su detalle. */
export function FieldsTable({
  fields,
  total,
  onOpen
}: {
  readonly fields: ReadonlyArray<ContactFieldSummary>;
  readonly total: number;
  readonly onOpen: (field: ContactFieldSummary) => void;
}) {
  return (
    <section className="cf-card" aria-label="Tus campos">
      <div className="cf-card__head">
        <h2>Tuyos <span>{fields.length}</span></h2>
        <p>Los llenan tus flujos, tu equipo o una integración. Se usan con su clave en mensajes y condiciones.</p>
      </div>
      <div className="cf-table">
        <div className="cf-table__head" aria-hidden="true">
          <span>Campo</span>
          <span>Tipo</span>
          <span>Lleno en</span>
          <span>Lo usan</span>
          <span />
        </div>
        <ul className="cf-table__rows">
          {fields.map((field) => {
            const percent = filledPercent(field.filled, total);
            const uses = usesSummary(field.uses);
            return (
              <li key={field.id}>
                <button type="button" className="cf-row" aria-label={`${field.label} · ${typeLabel(field.type, field.options)} · lleno en ${percent} % · ${uses.text}`} onClick={() => onOpen(field)}>
                  <span className="cf-row__name">
                    <strong>{field.label}</strong>
                    <code>{`{${field.key}}`}</code>
                  </span>
                  <span><TypeChip type={field.type} options={field.options} /></span>
                  <span className="cf-row__fill" title={`${field.filled} de ${total} clientes`}>
                    <span className="cf-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
                    <strong>{percent} %</strong>
                  </span>
                  <span className={`cf-row__uses${uses.warn ? " is-warn" : ""}`}>{uses.text}</span>
                  <span className="cf-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
