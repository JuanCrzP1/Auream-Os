import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BUSINESS_DATA_LIMITS, businessValuesOf, type BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { BUSINESS_SCHEDULE_LIMITS, scheduleState, type BusinessDataSchedule, type SaveBusinessScheduleRequest } from "@contracts/BusinessDataTimeline";
import { coerceFieldValue } from "@contracts/FieldValues";
import type { ScheduleWhen } from "@contracts/ScheduledMessageContracts";
import { addDays, instantOf, wallOf, zoneLabel } from "@shared/format/zonedTime";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { CustomerPreview } from "../datum/CustomerPreview";
import { editable } from "../datum/DatumEditor";
import { ValueInput } from "../datum/ValueInput";
import { spanLabel } from "./scheduleText";

/** Uno nuevo empieza mañana a las 00:00 y dura un día: lo más común (un festivo). */
function defaults(now: Date, timeZone: string): { readonly from: ScheduleWhen; readonly until: ScheduleWhen } {
  const tomorrow = addDays(wallOf(now, timeZone).date, 1);
  return { from: { date: tomorrow, time: "00:00" }, until: { date: addDays(tomorrow, 1), time: "00:00" } };
}

const whenOf = (iso: string, timeZone: string): ScheduleWhen => {
  const wall = wallOf(new Date(iso), timeZone);
  return { date: wall.date, time: wall.time };
};

const complete = (when: ScheduleWhen) => /^\d{4}-\d{2}-\d{2}$/.test(when.date) && /^\d{2}:\d{2}$/.test(when.time);

/**
 * Programar (o editar) un cambio: el valor mientras dura, desde y hasta en
 * la hora de la empresa, una nota y cómo lo verá el cliente. Si ya empezó,
 * «desde» no se mueve. El servidor revisa lo demás (cruces, tipo, un año).
 */
export function ScheduleForm({
  datum,
  all,
  schedule,
  timeZone,
  now,
  onSubmit,
  onCancel
}: {
  readonly datum: BusinessDatumSummary;
  readonly all: ReadonlyArray<BusinessDatumSummary>;
  /** El que se edita; sin él, uno nuevo. */
  readonly schedule?: BusinessDataSchedule;
  readonly timeZone: string;
  readonly now: Date;
  readonly onSubmit: (request: SaveBusinessScheduleRequest) => Promise<unknown>;
  readonly onCancel: () => void;
}) {
  const titleId = useId();
  const valueId = useId();
  const started = schedule ? scheduleState(schedule, now) === "active" : false;
  const initial = schedule ? { from: whenOf(schedule.startsAt, timeZone), until: whenOf(schedule.endsAt, timeZone) } : defaults(now, timeZone);
  const [value, setValue] = useState(schedule ? editable({ type: datum.type, value: schedule.value }) : "");
  const [from, setFrom] = useState<ScheduleWhen>(initial.from);
  const [until, setUntil] = useState<ScheduleWhen>(initial.until);
  const [note, setNote] = useState(schedule?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Al abrirse, a la vista: suele quedar debajo de las tarjetas.
  useEffect(() => {
    formRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);

  const span = complete(from) && complete(until) ? instantOf(until, timeZone).getTime() - Math.max(instantOf(from, timeZone).getTime(), now.getTime()) : NaN;
  const problem = Number.isNaN(span) ? "Elige fecha y hora en «desde» y «hasta»." : span < 60_000 ? "«Hasta» va después de «desde»." : null;
  const values = useMemo(() => ({ ...businessValuesOf(all, now), [datum.key]: coerceFieldValue({ type: datum.type, options: [] }, value) ?? value }), [all, now, datum.key, datum.type, value]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ value, from, until, note: note.trim() });
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el cambio programado."));
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} className="bd-schedule-form" aria-labelledby={titleId} onSubmit={(event) => (event.preventDefault(), void submit())}>
      <h4 id={titleId}>{schedule ? "Editar el cambio programado" : "Programar un cambio"}</h4>
      <div className="ui-field">
        <span id={valueId}>Valor mientras dura</span>
        <ValueInput labelId={valueId} type={datum.type} value={value} onChange={setValue} />
      </div>
      <div className="ui-field">
        <span>Desde</span>
        <div className="bd-schedule-form__when">
          <input className="ui-input" aria-label="Fecha desde" type="date" value={from.date} disabled={started} onChange={(e) => setFrom({ ...from, date: e.target.value })} />
          <input className="ui-input" aria-label="Hora desde" type="time" step={60} value={from.time} disabled={started} onChange={(e) => setFrom({ ...from, time: e.target.value })} />
        </div>
        {started ? <span className="bd-schedule-form__hint">Ya empezó: «desde» no se mueve.</span> : null}
      </div>
      <div className="ui-field">
        <span>Hasta</span>
        <div className="bd-schedule-form__when">
          <input className="ui-input" aria-label="Fecha hasta" type="date" min={from.date} value={until.date} onChange={(e) => setUntil({ ...until, date: e.target.value })} />
          <input className="ui-input" aria-label="Hora hasta" type="time" step={60} value={until.time} onChange={(e) => setUntil({ ...until, time: e.target.value })} />
        </div>
      </div>
      <span className={`bd-schedule-form__hint${problem ? " is-problem" : ""}`} role={problem ? "alert" : undefined}>
        {problem ?? `${zoneLabel(timeZone)}, la de tu empresa. Dura ${spanLabel(span)}; después vuelve solo el valor de siempre.`}
      </span>
      <label className="ui-field">
        <span>Nota <em className="bd-dialog__optional">(opcional)</em></span>
        <input className="ui-input" value={note} maxLength={BUSINESS_SCHEDULE_LIMITS.maxNote} placeholder="Navidad, festivo, promo de fin de semana…" onChange={(e) => setNote(e.target.value)} />
      </label>
      {value.trim() ? <CustomerPreview datumKey={datum.key} example={datum.example} values={values} /> : null}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      <footer>
        <button type="button" className="ui-btn" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="submit" className="ui-btn ui-btn--primary" disabled={busy || !value.trim() || value.length > BUSINESS_DATA_LIMITS.maxValue || problem !== null}>
          {busy ? "Guardando…" : schedule ? "Guardar cambios" : "Programar"}
        </button>
      </footer>
    </form>
  );
}
