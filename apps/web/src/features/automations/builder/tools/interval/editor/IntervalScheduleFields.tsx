import { WEEKDAYS, type IntervalSchedule } from "@contracts/IntervalConfig";
import {
  WEEKDAY_LABELS,
  activeDays,
  addRange,
  editRange,
  removeRange,
  toggleDay
} from "../intervalSchedule";
import { IntervalScheduleDay } from "./IntervalScheduleDay";

interface IntervalScheduleFieldsProps {
  readonly schedule: IntervalSchedule;
  readonly onChange: (schedule: IntervalSchedule) => void;
}

/**
 * La semana. Solo compone: cada gesto llama a su operación pura de
 * `intervalSchedule`. El aviso de «ningún día activo» anticipa lo que
 * `validateInterval` rechazará; no es una segunda validación.
 */
export function IntervalScheduleFields({ schedule, onChange }: IntervalScheduleFieldsProps) {
  const hasActiveDays = activeDays(schedule).length > 0;

  return (
    <div className="iv-schedule">
      <span className="iv-field__label">Horarios permitidos</span>
      <p className="iv-field__hint">La conversación continuará dentro de las horas que actives.</p>

      <ul className="iv-schedule__days">
        {WEEKDAYS.map((day) => (
          <IntervalScheduleDay
            key={day}
            day={day}
            name={WEEKDAY_LABELS[day]}
            value={schedule[day]}
            onToggle={(enabled) => onChange(toggleDay(schedule, day, enabled))}
            onAddRange={() => onChange(addRange(schedule, day))}
            onRemoveRange={(index) => onChange(removeRange(schedule, day, index))}
            onEditRange={(index, edge, time) => onChange(editRange(schedule, day, index, edge, time))}
          />
        ))}
      </ul>

      {hasActiveDays ? null : (
        <p className="iv-schedule__empty">
          Ningún día activo todavía. Activa al menos uno para poder guardar.
        </p>
      )}
    </div>
  );
}
