import { useId } from "react";
import type { IntervalMoment } from "@contracts/IntervalConfig";
import { IntervalTimeControl } from "./IntervalTimeControl";

interface IntervalDateFieldsProps {
  readonly moment: IntervalMoment | null;
  readonly onChange: (moment: IntervalMoment) => void;
}

/**
 * Día (nativo: calendario y localización del sistema) y hora (tres piezas de
 * `IntervalTimeControl`).
 *
 * El día es CONTROLADO a propósito: no controlado era una segunda fuente de
 * verdad que el borrador no podía corregir, y rompía Guardar. Cada campo
 * conserva al otro leyéndolo de la configuración, nunca del DOM. Sin fecha no
 * se inventa ninguna.
 */
export function IntervalDateFields({ moment, onChange }: IntervalDateFieldsProps) {
  const dateId = useId();

  return (
    <div className="iv-date">
      <span className="iv-field__label">Continuar el</span>

      <div className="iv-date__controls">
        <div className="iv-date__field">
          <label className="iv-date__caption" htmlFor={dateId}>
            Fecha
          </label>
          <input
            id={dateId}
            type="date"
            className="iv-date__input nodrag nowheel"
            aria-label="Fecha"
            value={moment?.date ?? ""}
            onChange={(event) => onChange({ date: event.target.value, time: moment?.time ?? "" })}
          />
        </div>

        <div className="iv-date__field">
          <span className="iv-date__caption">Hora</span>
          <IntervalTimeControl
            label="Hora a la que continuar"
            value={moment?.time ?? ""}
            onChange={(time) => onChange({ date: moment?.date ?? "", time })}
          />
        </div>
      </div>
    </div>
  );
}
