import { scheduleState, type BusinessDataSchedule } from "@contracts/BusinessDataTimeline";
import { shortRange } from "../schedules/scheduleText";

/** Un momento que se puede mirar en «Así lo ve tu cliente»: el de siempre o un cambio programado. */
export interface PreviewMoment {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  /** El valor de ese cambio; sin él, el de siempre (lo que se está escribiendo). */
  readonly value?: string;
  readonly active: boolean;
}

const MAX_UPCOMING = 3;

/** Primero el que rige ahora, luego el de siempre y los próximos (hasta 3). */
export function momentsOf(schedules: ReadonlyArray<BusinessDataSchedule>, timeZone: string, now: Date): PreviewMoment[] {
  const active = schedules.find((schedule) => scheduleState(schedule, now) === "active");
  const upcoming = schedules.filter((schedule) => scheduleState(schedule, now) === "upcoming").slice(0, MAX_UPCOMING);
  const name = (schedule: BusinessDataSchedule) => schedule.note || shortRange(schedule, timeZone);
  return [
    ...(active ? [{ id: active.id, label: `Ahora · ${name(active)}`, title: "Lo que reciben tus clientes en este momento", value: active.value, active: true }] : []),
    { id: "usual", label: active ? "Siempre" : "Ahora", title: "El valor de siempre", active: !active },
    ...upcoming.map((schedule) => ({ id: schedule.id, label: `Durante «${name(schedule)}»`, title: shortRange(schedule, timeZone), value: schedule.value, active: false }))
  ];
}

/** Botones para ver el mensaje en cada momento. */
export function PreviewMoments({ moments, selected, onSelect }: { readonly moments: ReadonlyArray<PreviewMoment>; readonly selected: string; readonly onSelect: (id: string) => void }) {
  return (
    <div className="bd-moments" role="radiogroup" aria-label="Ver el mensaje">
      {moments.map((moment) => (
        <button key={moment.id} type="button" role="radio" aria-checked={moment.id === selected} title={moment.title} className={moment.id === selected ? "is-on" : undefined} onClick={() => onSelect(moment.id)}>
          {moment.label}
        </button>
      ))}
    </div>
  );
}
