import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MS, type ScheduleWhen } from "@contracts/ScheduledMessageContracts";

// ---------------------------------------------------------------------------
// Las horas de los mensajes programados, siempre en la zona del NEGOCIO (la
// misma con la que el servidor las lee): los atajos («mañana temprano»…), la
// etiqueta de cuándo sale y la revisión antes de enviar. Puro.
// ---------------------------------------------------------------------------

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly when: ScheduleWhen;
}

interface Wall {
  readonly date: string;
  readonly time: string;
  /** 0 = domingo. */
  readonly weekday: number;
}

const DAY_MS = 86_400_000;
const pad = (value: number) => String(value).padStart(2, "0");

function partsIn(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

/** Fecha y hora de pared del negocio en ese instante. */
export function wallOf(instant: Date, timeZone: string): Wall {
  const p = partsIn(instant, timeZone);
  const date = `${p["year"]}-${pad(p["month"]!)}-${pad(p["day"]!)}`;
  return { date, time: `${pad(p["hour"]!)}:${pad(p["minute"]!)}`, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

/** El instante en que el reloj del negocio marca `when` (como el servidor). */
export function instantOf(when: ScheduleWhen, timeZone: string): Date {
  const naive = Date.parse(`${when.date}T${when.time}:00Z`);
  const offset = (at: number) => {
    const p = partsIn(new Date(at), timeZone);
    return Date.UTC(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!, p["second"]!) - Math.floor(at / 1000) * 1000;
  };
  const first = naive - offset(naive);
  return new Date(naive - offset(first));
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
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

/** «Hora de Colombia» (el nombre del país en español); si el navegador no lo sabe, la ciudad de la zona. */
export function zoneLabel(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("es", { timeZone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    // Donde no hay horario de verano, el navegador dice «hora estándar de…»: sobra el «estándar».
    const plain = name?.replace(/\s+estándar/i, "");
    if (plain && !/^GMT|^UTC/.test(plain)) return plain.charAt(0).toUpperCase() + plain.slice(1);
  } catch {
    // Zona que el navegador no conoce: abajo, la ciudad.
  }
  return `Hora de ${(timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ")}`;
}
