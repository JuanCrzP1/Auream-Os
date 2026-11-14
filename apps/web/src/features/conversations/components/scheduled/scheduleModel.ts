import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MS, type ScheduleWhen } from "@contracts/ScheduledMessageContracts";
import { addDays, instantOf, wallOf } from "@shared/format/zonedTime";

// Las horas de pared del negocio son compartidas (también las usan los cambios programados de Datos del negocio).
export { addDays, instantOf, wallOf, zoneLabel } from "@shared/format/zonedTime";

// ---------------------------------------------------------------------------
// Las horas de los mensajes programados, siempre en la zona del NEGOCIO (la
// misma con la que el servidor las lee): los atajos («mañana temprano»…), la
// etiqueta de cuándo sale y la revisión antes de enviar. Puro.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly when: ScheduleWhen;
}

/** Atajos: en 1 hora (redondeado a 5 min), mañana temprano y en la tarde, y el lunes. */
export function presets(now: Date, timeZone: string): Preset[] {
  const inAnHour = new Date(Math.ceil((now.getTime() + 3_600_000) / 300_000) * 300_000);
  const today = wallOf(now, timeZone);
  const tomorrow = addDays(today.date, 1);
  const toMonday = (8 - today.weekday) % 7 || 7;
  const list: Preset[] = [
    { id: "hour", label: "En 1 hora", when: { date: wallOf(inAnHour, timeZone).date, time: wallOf(inAnHour, timeZone).time } },
    { id: "morning", label: "Mañana temprano", when: { date: tomorrow, time: "09:00" } },
    { id: "afternoon", label: "Mañana en la tarde", when: { date: tomorrow, time: "15:00" } }
  ];
  // El domingo, «el lunes» es mañana temprano: no se repite.
  if (toMonday > 1) list.push({ id: "monday", label: "El lunes", when: { date: addDays(today.date, toMonday), time: "09:00" } });
  return list;
}

/** Por qué no se puede programar a esa hora (o `null`). Igual que el servidor. */
export function whenProblem(when: ScheduleWhen, timeZone: string, now: Date): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(when.date) || Number.isNaN(Date.parse(`${when.date}T00:00:00Z`))) return "Elige una fecha válida.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(when.time)) return "Elige una hora válida.";
  const lead = instantOf(when, timeZone).getTime() - now.getTime();
  if (lead < SCHEDULE_MIN_LEAD_MS) return "Elige una hora al menos un minuto más adelante.";
  if (lead > SCHEDULE_MAX_DAYS * DAY_MS) return `Se puede programar hasta ${SCHEDULE_MAX_DAYS} días adelante.`;
  return null;
}

/** «hoy, 4:30 p. m.», «mañana, 9:00 a. m.» o «lun 17 nov, 9:00 a. m.» (con el año si no es este). */
export function whenLabel(instant: Date, timeZone: string, now: Date): string {
  const time = new Intl.DateTimeFormat("es", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(instant);
  const day = wallOf(instant, timeZone).date;
  const today = wallOf(now, timeZone).date;
  if (day === today) return `hoy, ${time}`;
  if (day === addDays(today, 1)) return `mañana, ${time}`;
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const date = new Intl.DateTimeFormat("es", { timeZone, weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(instant);
  return `${date.replace(/\./g, "").replace(/,/g, "")}, ${time}`;
}
