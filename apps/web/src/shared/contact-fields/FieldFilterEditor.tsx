import "./field-filter-editor.css";
import { useEffect, useState } from "react";
import type { ContactFieldSummary, ContactFieldType } from "@contracts/ContactFieldContracts";
import { FIELD_FILTER_LIMITS, type FieldFilter, type FieldFilterOp } from "@contracts/ContactFieldFilters";

// ---------------------------------------------------------------------------
// Filtrar clientes por sus Campos del cliente (Difusiones y el CRM): se elige
// el campo y la regla de su tipo. Lista: se tocan las opciones. Sí o no: Sí /
// No. Número y fecha: desde / hasta. Cualquiera: tiene o no tiene el dato.
// Hacia afuera solo salen los filtros COMPLETOS (uno a medias no cambia nada).
// ---------------------------------------------------------------------------

const OPS: Readonly<Record<ContactFieldType, ReadonlyArray<readonly [FieldFilterOp, string]>>> = {
  list: [["in", "es una de"], ["filled", "tiene dato"], ["empty", "no tiene dato"]],
  text: [["in", "es"], ["filled", "tiene dato"], ["empty", "no tiene dato"]],
  boolean: [["yes", "es Sí"], ["no", "es No"], ["filled", "tiene dato"], ["empty", "no tiene dato"]],
  number: [["between", "está entre"], ["filled", "tiene dato"], ["empty", "no tiene dato"]],
  date: [["between", "está entre"], ["filled", "tiene dato"], ["empty", "no tiene dato"]]
};

const complete = (filter: FieldFilter) => (filter.op === "in" ? (filter.values?.length ?? 0) > 0 : filter.op === "between" ? Boolean(filter.min || filter.max) : true);
const same = (a: ReadonlyArray<FieldFilter>, b: ReadonlyArray<FieldFilter>) => JSON.stringify(a) === JSON.stringify(b);

function Control({ field, filter, onChange }: { field: ContactFieldSummary; filter: FieldFilter; onChange: (filter: FieldFilter) => void }) {
  const name = field.label;
  if (filter.op === "in" && field.type === "list") {
    const chosen = new Set(filter.values ?? []);
    return (
      <span className="ff-options" role="group" aria-label={`Opciones de ${name}`}>
        {field.options.map((option) => (
          <button key={option} type="button" className="ff-option" aria-pressed={chosen.has(option)} onClick={() => onChange({ ...filter, values: chosen.has(option) ? [...chosen].filter((value) => value !== option) : [...chosen, option] })}>
            {option}
          </button>
        ))}
      </span>
    );
  }
  if (filter.op === "in") {
    return (
      <input
        className="ui-input"
        aria-label={`Valores de ${name}`}
        placeholder="Uno o varios, separados por coma"
        defaultValue={(filter.values ?? []).join(", ")}
        onChange={(event) => onChange({ ...filter, values: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
      />
    );
  }
  if (filter.op === "between") {
    const type = field.type === "date" ? "date" : "text";
    const edge = (side: "min" | "max", value: string) => {
      const { [side]: _old, ...rest } = filter;
      onChange(value ? { ...rest, [side]: value } : rest);
    };
    return (
      <span className="ff-range">
        <input className="ui-input" type={type} inputMode={type === "text" ? "decimal" : undefined} aria-label={`${name}: desde`} placeholder="Desde" value={filter.min ?? ""} onChange={(event) => edge("min", event.target.value)} />
        <span>y</span>
        <input className="ui-input" type={type} inputMode={type === "text" ? "decimal" : undefined} aria-label={`${name}: hasta`} placeholder="Hasta" value={filter.max ?? ""} onChange={(event) => edge("max", event.target.value)} />
      </span>
    );
  }
  return null;
}

export function FieldFilterEditor({
  fields,
  value,
  onChange
}: {
  /** Los Campos del cliente de la cuenta. */
  readonly fields: ReadonlyArray<ContactFieldSummary>;
  readonly value: ReadonlyArray<FieldFilter>;
  readonly onChange: (filters: FieldFilter[]) => void;
}) {
  const [rows, setRows] = useState<FieldFilter[]>(() => [...value]);
  // Si los filtros cambian desde afuera (una audiencia guardada, «Limpiar»), se muestran esos.
  useEffect(() => {
    setRows((current) => (same(current.filter(complete), value) ? current : [...value]));
  }, [value]);

  const apply = (next: FieldFilter[]) => {
    setRows(next);
    const ready = next.filter(complete);
    if (!same(ready, value)) onChange(ready);
  };
  const fieldOf = (key: string) => fields.find((field) => field.key === key);
  const start = (field: ContactFieldSummary): FieldFilter => ({ key: field.key, op: OPS[field.type][0]![0] });
  const unused = fields.find((field) => !rows.some((row) => row.key === field.key)) ?? fields[0];

  if (fields.length === 0) return null;
  return (
    <div className="ff" role="group" aria-label="Filtros por campo">
      {rows.map((row, index) => {
        const field = fieldOf(row.key);
        const replace = (filter: FieldFilter) => apply(rows.map((current, at) => (at === index ? filter : current)));
        return (
          <div key={index} className="ff-row">
            <select className="ui-input ff-row__field" aria-label={`Campo del filtro ${index + 1}`} value={row.key} onChange={(event) => replace(start(fieldOf(event.target.value)!))}>
              {field ? null : <option value={row.key}>{row.key}</option>}
              {fields.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <select className="ui-input ff-row__op" aria-label={`Regla del filtro ${index + 1}`} value={row.op} onChange={(event) => replace({ key: row.key, op: event.target.value as FieldFilterOp })}>
              {OPS[field?.type ?? "text"].map(([op, label]) => <option key={op} value={op}>{label}</option>)}
            </select>
            {field ? <Control field={field} filter={row} onChange={replace} /> : null}
            <button type="button" className="ff-row__remove" aria-label={`Quitar el filtro ${index + 1}`} onClick={() => apply(rows.filter((_, at) => at !== index))}>×</button>
          </div>
        );
      })}
      {rows.length < FIELD_FILTER_LIMITS.maxFilters && unused ? (
        <button type="button" className="ff-add" onClick={() => apply([...rows, start(unused)])}>+ Filtrar por campo</button>
      ) : null}
    </div>
  );
}
