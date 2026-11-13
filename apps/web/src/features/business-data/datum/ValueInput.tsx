import { BUSINESS_DATA_LIMITS, type BusinessDataType } from "@contracts/BusinessDataContracts";
import { foldAnswer } from "@contracts/FieldValues";
import { PLACEHOLDER } from "../businessDataText";

/**
 * El valor según su tipo: texto de varias líneas (una cuenta o un horario
 * suelen ocupar varias), número, fecha del calendario o Sí / No. Se escribe
 * como lo escribe una persona; el servidor lo guarda con su tipo.
 */
export function ValueInput({ type, value, onChange, labelId }: { readonly type: BusinessDataType; readonly value: string; readonly onChange: (value: string) => void; /** El id del rótulo «Valor». */ readonly labelId: string }) {
  if (type === "boolean") {
    return (
      <span className="bd-yesno" role="radiogroup" aria-labelledby={labelId}>
        {["Sí", "No"].map((answer) => {
          const on = foldAnswer(value) === foldAnswer(answer) || (answer === "Sí" ? value === "true" : value === "false");
          return (
            <button key={answer} type="button" role="radio" aria-checked={on} className={on ? "is-on" : undefined} onClick={() => onChange(answer)}>
              {answer}
            </button>
          );
        })}
      </span>
    );
  }
  if (type === "date") {
    return <input aria-labelledby={labelId} type="date" className="ui-input" value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""} onChange={(event) => onChange(event.target.value)} />;
  }
  if (type === "number") {
    return <input aria-labelledby={labelId} className="ui-input" inputMode="decimal" value={value} placeholder={PLACEHOLDER.number} onChange={(event) => onChange(event.target.value)} />;
  }
  return (
    <textarea
      aria-labelledby={labelId}
      className="ui-input bd-value"
      rows={3}
      maxLength={BUSINESS_DATA_LIMITS.maxValue}
      value={value}
      placeholder={PLACEHOLDER.text}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
