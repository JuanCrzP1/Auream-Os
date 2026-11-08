import { useId } from "react";
import type { ScheduleDay, Weekday } from "@contracts/IntervalConfig";
import { SwitchControl } from "../../_kit/Switch";
import { IntervalTimeControl } from "./IntervalTimeControl";

interface IntervalScheduleDayProps {
  readonly day: Weekday;
  readonly name: string;
  readonly value: ScheduleDay;
  readonly onToggle: (enabled: boolean) => void;
  readonly onAddRange: () => void;
  readonly onRemoveRange: (index: number) => void;
  readonly onEditRange: (index: number, edge: "start" | "end", time: string) => void;
}

/**
 * Un día: interruptor y franjas. Apagado no pinta sus franjas (se conservan,
 * pero mostrarlas diría que están vigentes).
 */
export function IntervalScheduleDay({
  day,
  name,
  value,
  onToggle,
  onAddRange,
  onRemoveRange,
  onEditRange
}: IntervalScheduleDayProps) {
  const nameId = useId();

  return (
    <li className={`iv-day${value.enabled ? " iv-day--on" : ""}`}>
      <div className="iv-day__head">
        <span className="iv-day__name" id={nameId}>
          {name}
        </span>
        <SwitchControl checked={value.enabled} onChange={onToggle} labelledBy={nameId} />
      </div>

      {value.enabled ? (
        <div className="iv-day__ranges">
          {value.ranges.map((range, index) => (
            // La posición es la clave: una franja no tiene identidad y la lista
            // no se reordena mientras se edita.
            <div className="iv-range" key={`${day}-${index}`}>
              <IntervalTimeControl
                className="iv-range__time"
                label={`${name}: inicio`}
                value={range.start}
                onChange={(time) => onEditRange(index, "start", time)}
              />
              <span className="iv-range__dash" aria-hidden="true" />
              <IntervalTimeControl
                className="iv-range__time"
                label={`${name}: fin`}
                value={range.end}
                onChange={(time) => onEditRange(index, "end", time)}
              />
              <button
                type="button"
                className="iv-range__remove nodrag"
                aria-label={`Eliminar horario de ${name.toLowerCase()}, ${range.start} a ${range.end}`}
                title="Eliminar horario"
                onClick={() => onRemoveRange(index)}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                </svg>
              </button>
            </div>
          ))}

          <button type="button" className="iv-day__add nodrag" onClick={onAddRange}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3.75v8.5M3.75 8h8.5" />
            </svg>
            Añadir horario
          </button>
        </div>
      ) : null}
    </li>
  );
}
