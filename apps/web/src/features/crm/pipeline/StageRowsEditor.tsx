import type { StageOutcome } from "@contracts/CrmContracts";
import { CRM_STAGES_MAX } from "@contracts/CrmContracts";
import { OUTCOME_LABEL } from "../crmFormat";

/** Una etapa en el editor: su id (si ya existe), nombre, color y qué quiere decir. */
export interface StageRow {
  readonly key: string;
  readonly id?: string;
  readonly name: string;
  readonly color: string;
  readonly outcome: StageOutcome;
}

const PALETTE = ["#8b5cf6", "#6c5ce7", "#4f6bed", "#0ea5e9", "#0d9488", "#0b7a70", "#d97706", "#e11d48"];

/** Las etapas en orden: subir, bajar, quitar y añadir (hasta 12). */
export function StageRowsEditor({ rows, onChange }: { readonly rows: ReadonlyArray<StageRow>; readonly onChange: (rows: ReadonlyArray<StageRow>) => void }) {
  const patch = (index: number, change: Partial<StageRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  const swap = (index: number, to: number) => {
    const next = [...rows];
    [next[index], next[to]] = [next[to]!, next[index]!];
    onChange(next);
  };
  return (
    <div className="stage-rows">
      <div className="stage-rows__head" aria-hidden="true">
        <span>Etapa</span>
        <span>Quiere decir</span>
      </div>
      {rows.map((row, index) => (
        <div key={row.key} className="stage-rows__row">
          <span className="stage-rows__order">
            <button type="button" aria-label={`Subir ${row.name || "etapa"}`} disabled={index === 0} onClick={() => swap(index, index - 1)}>▲</button>
            <button type="button" aria-label={`Bajar ${row.name || "etapa"}`} disabled={index === rows.length - 1} onClick={() => swap(index, index + 1)}>▼</button>
          </span>
          <input type="color" className="stage-rows__color" value={row.color} aria-label={`Color de ${row.name || "la etapa"}`} onChange={(event) => patch(index, { color: event.target.value })} />
          <input className="ui-input stage-rows__name" value={row.name} maxLength={40} placeholder="Nombre de la etapa" aria-label={`Nombre de la etapa ${index + 1}`} onChange={(event) => patch(index, { name: event.target.value })} />
          <select className="ui-input stage-rows__outcome" value={row.outcome} aria-label={`Qué quiere decir ${row.name || "la etapa"}`} onChange={(event) => patch(index, { outcome: event.target.value as StageOutcome })}>
            {(Object.keys(OUTCOME_LABEL) as StageOutcome[]).map((outcome) => <option key={outcome} value={outcome}>{OUTCOME_LABEL[outcome]}</option>)}
          </select>
          <button type="button" className="stage-rows__remove" aria-label={`Quitar ${row.name || "etapa"}`} disabled={rows.length <= 2} onClick={() => onChange(rows.filter((_, i) => i !== index))}>×</button>
        </div>
      ))}
      {rows.length < CRM_STAGES_MAX ? (
        <button
          type="button"
          className="stage-rows__add"
          onClick={() => onChange([...rows, { key: crypto.randomUUID(), name: "", color: PALETTE[rows.length % PALETTE.length]!, outcome: "open" }])}
        >
          + Añadir etapa
        </button>
      ) : null}
    </div>
  );
}
