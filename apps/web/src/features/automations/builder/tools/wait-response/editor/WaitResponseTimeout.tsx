import { useId } from "react";
import type { WaitResponseTimeUnit } from "@contracts/WaitResponseConfig";

interface WaitResponseTimeoutProps {
  readonly amount: number;
  readonly unit: WaitResponseTimeUnit;
  readonly onChange: (amount: number, unit: WaitResponseTimeUnit) => void;
}

/** Nombres visibles de las unidades que define el contrato. */
const UNITS: ReadonlyArray<{ readonly value: WaitResponseTimeUnit; readonly label: string }> = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" }
];

/**
 * Tiempo máximo de espera. Botones en vez de `<select>`: el desplegable
 * nativo no admite tema oscuro. La cantidad se acota a enteros > 0 en la
 * entrada; la validación lo vuelve a comprobar sobre el dato guardado.
 */
export function WaitResponseTimeout({ amount, unit, onChange }: WaitResponseTimeoutProps) {
  const amountId = useId();

  return (
    <div className="wr-timeout">
      <label className="wr-timeout__label" htmlFor={amountId}>
        Tiempo máximo
      </label>

      <div className="wr-timeout__controls">
        <input
          id={amountId}
          type="number"
          min={1}
          step={1}
          className="wr-timeout__amount nodrag"
          value={amount}
          onChange={(event) => {
            const whole = Math.floor(Number(event.target.value));
            onChange(Number.isFinite(whole) && whole > 0 ? whole : 1, unit);
          }}
        />

        <div className="wr-timeout__units" role="radiogroup" aria-label="Unidad del tiempo máximo">
          {UNITS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === unit}
              className={`wr-timeout__unit nodrag${option.value === unit ? " wr-timeout__unit--active" : ""}`}
              onClick={() => onChange(amount, option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
