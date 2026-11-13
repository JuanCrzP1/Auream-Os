import type { ContactFieldDefinition } from "@contracts/ContactFieldContracts";
import type { ContactFieldValue } from "@contracts/ContactContracts";
import { foldAnswer } from "@contracts/FieldValues";

/** Lo que se está escribiendo: el dato guardado o el texto del input. `null`: sin dato. */
export type FieldDraft = ContactFieldValue | null;

const asText = (value: FieldDraft) => (value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("es-CO") : String(value));

/**
 * Un dato de la ficha en la forma de su tipo: lista (desplegable), número,
 * fecha (calendario), sí o no (dos botones; tocar el elegido lo deja sin dato)
 * o texto. El servidor valida con la misma regla que al guardar desde un flujo.
 */
export function FieldValueInput({
  field,
  value,
  disabled,
  onChange
}: {
  readonly field: ContactFieldDefinition;
  readonly value: FieldDraft;
  readonly disabled: boolean;
  readonly onChange: (value: FieldDraft) => void;
}) {
  const label = field.label;
  switch (field.type) {
    case "list": {
      const current = typeof value === "string" ? value : "";
      // Un dato viejo que no está entre las opciones se sigue viendo (hasta que alguien elija una).
      const legacy = current && !field.options.some((option) => foldAnswer(option) === foldAnswer(current)) ? current : null;
      const selected = field.options.find((option) => foldAnswer(option) === foldAnswer(current)) ?? current;
      return (
        <select className="ui-input" aria-label={label} value={selected} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">Sin dato</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
          {legacy ? <option value={legacy}>{legacy} (no está en la lista)</option> : null}
        </select>
      );
    }
    case "boolean": {
      const yes = value === true || (typeof value === "string" && ["si", "yes", "true", "1"].includes(foldAnswer(value)));
      const no = value === false || (typeof value === "string" && ["no", "false", "0"].includes(foldAnswer(value)));
      return (
        <span className="cfv-segment" role="group" aria-label={label}>
          <button type="button" aria-pressed={yes} disabled={disabled} onClick={() => onChange(yes ? null : true)}>Sí</button>
          <button type="button" aria-pressed={no} disabled={disabled} onClick={() => onChange(no ? null : false)}>No</button>
        </span>
      );
    }
    case "date":
      return <input className="ui-input" type="date" aria-label={label} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)} />;
    case "number":
      return <input className="ui-input" inputMode="decimal" aria-label={label} value={asText(value)} placeholder="Sin dato" disabled={disabled} onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)} />;
    default:
      return <input className="ui-input" aria-label={label} value={asText(value)} placeholder="Sin dato" maxLength={2000} disabled={disabled} onChange={(event) => onChange(event.target.value ? event.target.value : null)} />;
  }
}
