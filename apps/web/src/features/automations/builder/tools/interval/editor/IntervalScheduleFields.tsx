import { WEEKDAYS, type IntervalSchedule } from "@contracts/IntervalConfig";
import {
  NOMBRES_DE_DIA,
  alternarDia,
  anadirFranja,
  diasActivos,
  editarFranja,
  quitarFranja
} from "../intervalSchedule";
import { IntervalScheduleDay } from "./IntervalScheduleDay";

interface IntervalScheduleFieldsProps {
  readonly schedule: IntervalSchedule;
  readonly onChange: (schedule: IntervalSchedule) => void;
}

/**
 * Modo «en horario permitido»: la semana entera.
 *
 * SOLO COMPONE. Cada gesto se traduce llamando a la operación pura que
 * corresponde —`alternarDia`, `anadirFranja`, `quitarFranja`, `editarFranja`—
 * y se publica el resultado. Aquí no se decide qué pasa al encender un día sin
 * franjas ni al quitar la última: eso son reglas del horario y viven en
 * `intervalSchedule.ts`, donde se pueden probar sin pantalla.
 *
 * El aviso de «ningún día activo» es informativo, no una validación paralela:
 * quien impide guardar es `validateInterval`, y este texto solo lo anticipa
 * para que el usuario no llegue al botón sin saber por qué está bloqueado.
 */
export function IntervalScheduleFields({ schedule, onChange }: IntervalScheduleFieldsProps) {
  const activos = diasActivos(schedule);

  return (
    <div className="iv-schedule">
      <span className="iv-field__label">Horarios permitidos</span>
      <p className="iv-field__hint">
        La conversación continuará dentro de las horas que actives.
      </p>

      <ul className="iv-schedule__days">
        {WEEKDAYS.map((dia) => (
          <IntervalScheduleDay
            key={dia}
            day={dia}
            nombre={NOMBRES_DE_DIA[dia]}
            value={schedule[dia]}
            onToggle={(enabled) => onChange(alternarDia(schedule, dia, enabled))}
            onAddRange={() => onChange(anadirFranja(schedule, dia))}
            onRemoveRange={(index) => onChange(quitarFranja(schedule, dia, index))}
            onEditRange={(index, extremo, hora) =>
              onChange(editarFranja(schedule, dia, index, extremo, hora))
            }
          />
        ))}
      </ul>

      {activos.length === 0 ? (
        <p className="iv-schedule__empty">
          Ningún día activo todavía. Activa al menos uno para poder guardar.
        </p>
      ) : null}
    </div>
  );
}
