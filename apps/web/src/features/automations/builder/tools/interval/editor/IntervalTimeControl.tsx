import { useRef, useState } from "react";
import {
  acceptsHour,
  acceptsMinute,
  canHourGrow,
  from24Hour,
  normalizeHour,
  normalizeMinute,
  to24Hour,
  type Meridiem
} from "../time12";

interface IntervalTimeControlProps {
  /** Hora guardada `HH:mm` (24 h). Vacía si aún no hay. */
  readonly value: string;
  /** Nombre accesible del grupo. */
  readonly label: string;
  readonly className?: string;
  /**
   * Nueva hora `HH:mm`, o `""` si está a medias. Publicar el vacío evita que
   * Guardar escriba una hora que el usuario ya borró.
   */
  readonly onChange: (time: string) => void;
}

const MERIDIEMS: ReadonlyArray<{ readonly value: Meridiem; readonly label: string }> = [
  { value: "am", label: "a. m." },
  { value: "pm", label: "p. m." }
];

interface TimeDraft {
  readonly hour: string;
  readonly minute: string;
  readonly meridiem: Meridiem;
}

/**
 * Hora en tres piezas: `[02] : [45]  [a. m.][p. m.]`.
 *
 * Cada pulsación se contrasta con el dominio (`time12`) ANTES de tocar el
 * estado: lo imposible no entra. Los dos puntos son decorativos. El foco salta
 * a los minutos cuando la hora ya no puede crecer. La mitad del día se pulsa,
 * no se escribe.
 *
 * El borrador local (para mostrar «» o «8» mientras se teclea) guarda contra
 * qué `value` se escribió (`base`) y caduca si `value` cambia por otro camino:
 * así la pantalla no puede divergir del borrador del nodo.
 */
export function IntervalTimeControl({ value, label, className, onChange }: IntervalTimeControlProps) {
  const minuteRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<(TimeDraft & { readonly base: string }) | null>(null);

  const current = draft !== null && draft.base === value ? draft : null;
  const stored = from24Hour(value);

  const hour = current?.hour ?? stored?.hour ?? "";
  const minute = current?.minute ?? stored?.minute ?? "";
  const meridiem = current?.meridiem ?? stored?.meridiem ?? "am";

  // Lo último aplicado, legible sin esperar al render: el autoavance dispara
  // el `blur` de la hora dentro del mismo evento, antes de pintar.
  const latest = useRef<TimeDraft>({ hour, minute, meridiem });
  latest.current = { hour, minute, meridiem };

  /** Adopta las piezas y publica. `base` = la hora que ESTO produce. */
  const apply = (next: TimeDraft) => {
    const time = to24Hour(next.hour, next.minute, next.meridiem) ?? "";

    latest.current = next;
    setDraft({ base: time, ...next });
    if (time !== value) onChange(time);
  };

  /** Rechaza la pulsación forzando un render con el mismo estado (input controlado). */
  const reject = () => setDraft({ base: value, hour, minute, meridiem });

  return (
    <div className={`iv-time${className ? ` ${className}` : ""}`} role="group" aria-label={label}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        className="iv-time__field nodrag"
        aria-label="Hora"
        placeholder="--"
        value={hour}
        onChange={(event) => {
          const text = event.target.value;
          if (!acceptsHour(text)) return reject();

          apply({ hour: text, minute, meridiem });

          if (text !== "" && !canHourGrow(text)) {
            minuteRef.current?.focus();
            minuteRef.current?.select();
          }
        }}
        onBlur={() => apply({ ...latest.current, hour: normalizeHour(latest.current.hour) })}
      />

      <span className="iv-time__colon" aria-hidden="true">
        :
      </span>

      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        className="iv-time__field nodrag"
        aria-label="Minutos"
        placeholder="--"
        value={minute}
        onChange={(event) => {
          const text = event.target.value;
          if (!acceptsMinute(text)) return reject();

          apply({ hour, minute: text, meridiem });
        }}
        onBlur={() => apply({ ...latest.current, minute: normalizeMinute(latest.current.minute) })}
      />

      <div className="iv-time__meridiem">
        {MERIDIEMS.map((option) => (
          <button
            key={option.value}
            type="button"
            // Alternancia sobre un dato que siempre tiene valor.
            aria-pressed={meridiem === option.value}
            className={`iv-time__half nodrag${meridiem === option.value ? " iv-time__half--on" : ""}`}
            onClick={() => apply({ hour, minute, meridiem: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
