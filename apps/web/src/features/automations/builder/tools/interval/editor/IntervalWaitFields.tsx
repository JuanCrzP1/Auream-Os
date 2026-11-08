import { useId } from "react";
import type { IntervalUnit, IntervalWait } from "@contracts/IntervalConfig";

const UNITS: ReadonlyArray<{ readonly value: IntervalUnit; readonly label: string }> = [
  { value: "seconds", label: "Segundos" },
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Días" }
];

interface IntervalWaitFieldsProps {
  readonly wait: IntervalWait;
  readonly onChange: (wait: IntervalWait) => void;
}

/**
 * Cantidad y unidad de la espera. No valida: emite lo escrito (también vacío,
 * para poder borrar y reescribir) y decide `validateInterval`.
 */
export function IntervalWaitFields({ wait, onChange }: IntervalWaitFieldsProps) {
  const amountId = useId();

  return (
    <div className="iv-wait">
      <label className="iv-field__label" htmlFor={amountId}>
        Esperar durante
      </label>

      <div className="iv-wait__controls">
        <input
          id={amountId}
          type="number"
          inputMode="numeric"
          min={1}
          className="iv-wait__amount nodrag"
          value={Number.isFinite(wait.amount) ? wait.amount : ""}
          onChange={(event) => onChange({ ...wait, amount: event.target.valueAsNumber })}
        />

        <div className="iv-wait__units" role="radiogroup" aria-label="Unidad de tiempo">
          {UNITS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={wait.unit === value}
              className={`iv-wait__unit nodrag${wait.unit === value ? " iv-wait__unit--on" : ""}`}
              onClick={() => onChange({ ...wait, unit: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
