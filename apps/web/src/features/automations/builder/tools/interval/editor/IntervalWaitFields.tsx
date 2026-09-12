import { useId } from "react";
import type { IntervalUnit, IntervalWait } from "@contracts/IntervalConfig";

/** Las cuatro unidades, con su rótulo. El valor es dato; el rótulo, pantalla. */
const UNIDADES: ReadonlyArray<{ readonly value: IntervalUnit; readonly label: string }> = [
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
 * Modo «después de un intervalo»: cuánto y en qué unidad.
 *
 * NO VALIDA NADA. Si el usuario borra el campo o escribe algo que no es un
 * número, se emite tal cual y quien decide si eso puede guardarse es
 * `validateInterval` — una sola fuente de reglas. Bloquear aquí la escritura
 * obligaría a repetir las mismas comprobaciones en dos sitios y, peor, dejaría
 * al usuario sin poder borrar para reescribir.
 *
 * SOLO PRESENTACIÓN: recibe la espera y una devolución de llamada.
 */
export function IntervalWaitFields({ wait, onChange }: IntervalWaitFieldsProps) {
  const idCantidad = useId();

  return (
    <div className="iv-wait">
      <label className="iv-field__label" htmlFor={idCantidad}>
        Esperar durante
      </label>

      <div className="iv-wait__controls">
        <input
          id={idCantidad}
          type="number"
          inputMode="numeric"
          min={1}
          className="iv-wait__amount nodrag"
          value={Number.isFinite(wait.amount) ? wait.amount : ""}
          onChange={(evento) =>
            onChange({ ...wait, amount: evento.target.valueAsNumber })
          }
        />

        <div className="iv-wait__units" role="radiogroup" aria-label="Unidad de tiempo">
          {UNIDADES.map(({ value, label }) => (
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
