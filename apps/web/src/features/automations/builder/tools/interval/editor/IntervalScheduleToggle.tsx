import { useId } from "react";
import { SwitchControl } from "../../_kit/Switch";
import { ScheduleIcon } from "../intervalModeIcons";

interface IntervalScheduleToggleProps {
  readonly value: boolean;
  readonly onChange: (enabled: boolean) => void;
}

/** Restricción horaria: tarjeta con icono, título, consecuencia e interruptor. */
export function IntervalScheduleToggle({ value, onChange }: IntervalScheduleToggleProps) {
  const titleId = useId();
  const hintId = useId();

  return (
    <div className={`iv-toggle${value ? " iv-toggle--on" : ""}`}>
      <span className="iv-toggle__glyph" aria-hidden="true">
        <ScheduleIcon />
      </span>

      <span className="iv-toggle__text">
        <span className="iv-toggle__title" id={titleId}>
          Solo en horario permitido
        </span>
        {/* La consecuencia, no el rótulo repetido. */}
        <span className="iv-toggle__hint" id={hintId}>
          {value ? "Esperará al siguiente tramo abierto." : "Continuará a cualquier hora."}
        </span>
      </span>

      <SwitchControl checked={value} onChange={onChange} labelledBy={titleId} describedBy={hintId} />
    </div>
  );
}
