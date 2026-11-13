import type { LabelOverview } from "@contracts/LabelManagementContracts";
import { hasHiddenChars, salesText, stageOf, usesText } from "../labelText";

/**
 * Cada etiqueta con sus clientes, lo que vendieron en 30 días (si quien mira
 * ve ventas) y quién la usa. Una que nadie usa ni tiene clientes se señala:
 * se puede borrar. Toda la fila abre su detalle.
 */
export function LabelsTable({ labels, canSeeSales, onOpen }: { readonly labels: ReadonlyArray<LabelOverview>; readonly canSeeSales: boolean; readonly onOpen: (label: LabelOverview) => void }) {
  return (
    <section className="lb-card" aria-label="Tus etiquetas">
      <div className={`lb-table${canSeeSales ? "" : " lb-table--no-sales"}`}>
        <div className="lb-table__head" aria-hidden="true">
          <span>Etiqueta</span>
          <span>Clientes</span>
          {canSeeSales ? <span>Vendieron · 30 d</span> : null}
          <span>La usan</span>
          <span />
        </div>
        <ul className="lb-table__rows">
          {labels.map((label) => {
            const stage = stageOf(label.uses);
            const others = usesText(label.uses.filter((use) => use.kind !== "stage"));
            const idle = label.uses.length === 0;
            const sales = salesText(label.sales);
            const clients = label.contactCount ?? 0;
            return (
              <li key={label.id}>
                <button type="button" className="lb-row" aria-label={`${label.name} · ${clients} ${clients === 1 ? "cliente" : "clientes"}`} onClick={() => onOpen(label)}>
                  <span className="lb-row__name">
                    <span className="lb-dot" style={{ background: label.color }} aria-hidden="true" />
                    <strong>{label.name}</strong>
                    {hasHiddenChars(label.name) ? <span className="lb-hidden" title="Tiene un carácter que no se ve: por eso el sistema la cuenta aparte">invisible</span> : null}
                  </span>
                  <span className="lb-row__count">{clients.toLocaleString("es-CO")}</span>
                  {canSeeSales ? <span className="lb-row__sales" title={sales?.title}>{sales?.text ?? "—"}</span> : null}
                  <span className="lb-row__uses">
                    {stage ? <span className="lb-stage">Etapa · {stage.pipelineName}</span> : null}
                    {others ? <span>{others}</span> : null}
                    {idle ? <span className={clients === 0 ? "lb-row__idle" : "ui-muted"}>{clients === 0 ? "Nadie la usa · se puede borrar" : "Solo la tienen sus clientes"}</span> : null}
                  </span>
                  <span className="lb-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
