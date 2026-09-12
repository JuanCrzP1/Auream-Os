import { useId } from "react";
import type { ScheduleDay, Weekday } from "@contracts/IntervalConfig";
import { IntervalTimeControl } from "./IntervalTimeControl";

interface IntervalScheduleDayProps {
  readonly day: Weekday;
  readonly nombre: string;
  readonly value: ScheduleDay;
  readonly onToggle: (enabled: boolean) => void;
  readonly onAddRange: () => void;
  readonly onRemoveRange: (index: number) => void;
  readonly onEditRange: (index: number, extremo: "start" | "end", hora: string) => void;
}

/**
 * Un día del horario: su interruptor y sus franjas.
 *
 * TARJETA, NO FILA DE TABLA. Siete días con varias franjas cada uno en una
 * tabla serían una rejilla de administración; en tarjetas, un día apagado ocupa
 * una línea y solo el que está encendido despliega sus horas. Lo que se ve
 * crece con lo que hay configurado, no con lo que podría haber.
 *
 * APAGADO NO PINTA FRANJAS aunque las tenga guardadas. Se conservan —volver a
 * encender el día las devuelve— pero enseñarlas diría que están vigentes, y no
 * lo están.
 *
 * SOLO PRESENTACIÓN: no conoce la semana, ni el resto de días, ni cómo se
 * guarda. Recibe un día y avisa de los gestos.
 */
export function IntervalScheduleDay({
  day,
  nombre,
  value,
  onToggle,
  onAddRange,
  onRemoveRange,
  onEditRange
}: IntervalScheduleDayProps) {
  const idNombre = useId();

  return (
    <li className={`iv-day${value.enabled ? " iv-day--on" : ""}`}>
      <div className="iv-day__head">
        <span className="iv-day__name" id={idNombre}>
          {nombre}
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-labelledby={idNombre}
          className={`iv-switch nodrag${value.enabled ? " iv-switch--on" : ""}`}
          onClick={() => onToggle(!value.enabled)}
        >
          <span className="iv-switch__knob" aria-hidden="true" />
        </button>
      </div>

      {value.enabled ? (
        <div className="iv-day__ranges">
          {value.ranges.map((franja, index) => (
            /* La clave es la POSICIÓN porque una franja no tiene identidad
               propia: dos tramos idénticos el mismo día son el mismo dato, y
               darles un id inventado sería añadir estado que nadie lee. La lista
               no se reordena mientras se edita, así que el índice es estable
               mientras la fila existe. */
            <div className="iv-range" key={`${day}-${index}`}>
              {/* EL MISMO CONTROL QUE LA FECHA, pieza por pieza: hora,
                  minutos y mitad del día. Dejar aquí una caja de texto libre
                  habría significado que «10ndjd» seguía siendo escribible en la
                  mitad de la herramienta. */}
              <IntervalTimeControl
                className="iv-range__time"
                label={`${nombre}: inicio`}
                value={franja.start}
                onChange={(hora) => onEditRange(index, "start", hora)}
              />
              <span className="iv-range__dash" aria-hidden="true" />
              <IntervalTimeControl
                className="iv-range__time"
                label={`${nombre}: fin`}
                value={franja.end}
                onChange={(hora) => onEditRange(index, "end", hora)}
              />
              <button
                type="button"
                className="iv-range__remove nodrag"
                aria-label={`Eliminar horario de ${nombre.toLowerCase()}, ${franja.start} a ${franja.end}`}
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
