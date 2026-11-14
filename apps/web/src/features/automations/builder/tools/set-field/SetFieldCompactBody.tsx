import "../_kit/kit.css";
import "./set-field-node.css";
import type { ToolCompactProps } from "../ToolUi";
import { SET_FIELD_OPERATION_SIGN, readSetFieldConfig } from "./setFieldConfig";

/** Nodo cerrado: el dato como insignia y lo que se le hace. */
export function SetFieldCompactBody({ draft }: ToolCompactProps) {
  const read = readSetFieldConfig(draft.config);
  const value = read.value.trim();

  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">Guardar dato</span>
      {read.field ? (
        <div className="kit-node__row">
          <span className="kit-node__badge">{`{${read.field}}`}</span>
          <span className="kit-node__meta set-field-node__value" title={value}>{value ? (read.operation === "set" ? `= ${value}` : `${SET_FIELD_OPERATION_SIGN[read.operation]} ${value}`) : "Sin valor"}</span>
        </div>
      ) : (
        <span className="kit-node__meta">Sin dato elegido</span>
      )}
    </div>
  );
}
