import { SCHEDULE_MAX_DAYS, type ScheduleWhen } from "@contracts/ScheduledMessageContracts";
import { addDays, instantOf, presets, wallOf, whenLabel } from "./scheduleModel";

/** Lo que se elige: cuándo y si se cancela cuando el cliente responde antes. */
export interface ScheduleChoice {
  readonly when: ScheduleWhen;
  readonly cancelIfReplied: boolean;
}

/**
 * Cuándo sale: atajos con su fecha («Mañana temprano · mié 13, 9:00 a. m.»),
 * o fecha y hora propias, siempre en la zona del negocio; y «No enviar si el
 * cliente responde antes» (para seguimientos que no molestan a quien ya
 * contestó).
 */
export function WhenPicker({ timeZone, now, value, onChange }: { readonly timeZone: string; readonly now: Date; readonly value: ScheduleChoice; readonly onChange: (value: ScheduleChoice) => void }) {
  const today = wallOf(now, timeZone).date;
  const setWhen = (when: ScheduleWhen) => onChange({ ...value, when });

  return (
    <div className="when-picker">
      <div className="when-picker__presets" role="radiogroup" aria-label="Atajos">
        {presets(now, timeZone).map((preset) => {
          const selected = preset.when.date === value.when.date && preset.when.time === value.when.time;
          return (
            <button key={preset.id} type="button" role="radio" aria-checked={selected} className={`when-picker__preset${selected ? " is-selected" : ""}`} onClick={() => setWhen(preset.when)}>
              <span>{preset.label}</span>
              <span className="when-picker__detail">{whenLabel(instantOf(preset.when, timeZone), timeZone, now)}</span>
            </button>
          );
        })}
      </div>
      <fieldset className="when-picker__custom">
        <legend>Elegir fecha y hora</legend>
        <input
          className="ui-input"
          aria-label="Fecha"
          type="date"
          min={today}
          max={addDays(today, SCHEDULE_MAX_DAYS)}
          value={value.when.date}
          onChange={(event) => setWhen({ ...value.when, date: event.target.value })}
        />
        <input className="ui-input" aria-label="Hora" type="time" step={60} value={value.when.time} onChange={(event) => setWhen({ ...value.when, time: event.target.value })} />
      </fieldset>
      <label className="when-picker__check">
        <input type="checkbox" checked={value.cancelIfReplied} onChange={(event) => onChange({ ...value, cancelIfReplied: event.target.checked })} />
        <span>
          No enviar si el cliente responde antes
          <small>Ideal para seguimientos: no le escribes a quien ya contestó.</small>
        </span>
      </label>
    </div>
  );
}
