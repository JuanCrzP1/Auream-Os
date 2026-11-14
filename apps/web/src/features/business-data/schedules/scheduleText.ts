import type { BusinessDataUse } from "@contracts/BusinessDataContracts";
import { scheduleState, type BusinessDataSchedule } from "@contracts/BusinessDataTimeline";
import { wallOf } from "@shared/format/zonedTime";

// ---------------------------------------------------------------------------
// Cómo se dicen los cambios programados, siempre en la hora de la EMPRESA:
// «jue 24 dic, 8:00 a. m.», «2 días», «Empieza en 11 días», «Activo ahora ·
// vuelve en 2 días», la etiqueta de la lista («Navidad · 24 → 26 dic») y las
// difusiones que salen mientras rige uno. Puro.
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Range = Pick<BusinessDataSchedule, "startsAt" | "endsAt">;

/** «jue., 24 dic.» → «jue 24 dic». */
const clean = (text: string) => text.replace(/\./g, "").replace(/,/g, "");

/** «jue 24 dic, 8:00 a. m.» (con el año si no es el de hoy). */
export function momentLabel(iso: string, timeZone: string, now: Date): string {
  const at = new Date(iso);
  const sameYear = wallOf(at, timeZone).date.slice(0, 4) === wallOf(now, timeZone).date.slice(0, 4);
  const day = new Intl.DateTimeFormat("es", { timeZone, weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(at);
  const time = new Intl.DateTimeFormat("es", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(at);
  return `${clean(day)}, ${time}`;
}

/** «24 dic» (el día, sin hora). */
function dayLabel(iso: string, timeZone: string): string {
  return clean(new Intl.DateTimeFormat("es", { timeZone, day: "numeric", month: "short" }).format(new Date(iso)));
}

/** Cuánto es un lapso: «45 min», «6 h», «1 día y 18 h», «40 días». */
export function spanLabel(ms: number): string {
  // Se redondea primero: 59,6 min son «1 h» y 23,6 h son «1 día», no «60 min» ni «24 h».
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  const totalHours = Math.round(ms / HOUR);
  if (totalHours < 24) return `${totalHours} h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  const daysText = days === 1 ? "1 día" : `${days} días`;
  // Con dos días o más, las horas sobran: «40 días», no «40 días y 8 h».
  return days < 2 && hours > 0 ? `${daysText} y ${hours} h` : daysText;
}

/** Lo que dura: «2 días». */
export const lengthLabel = (schedule: Range) => spanLabel(Date.parse(schedule.endsAt) - Date.parse(schedule.startsAt));

/** «Empieza en 11 días» · «Activo ahora · vuelve en 2 días». */
export function stateLabel(schedule: Range, now: Date): string {
  const state = scheduleState(schedule, now);
  if (state === "upcoming") return `Empieza en ${spanLabel(Date.parse(schedule.startsAt) - now.getTime())}`;
  if (state === "active") return `Activo ahora · vuelve en ${spanLabel(Date.parse(schedule.endsAt) - now.getTime())}`;
  return "Terminó";
}

/** «24 → 26 dic», «31 dic → 2 ene» o «24 dic» si es un mismo día. */
export function shortRange(schedule: Range, timeZone: string): string {
  const [from, until] = [dayLabel(schedule.startsAt, timeZone), dayLabel(new Date(Date.parse(schedule.endsAt) - 1).toISOString(), timeZone)];
  if (from === until) return from;
  const [fromDay, fromMonth] = from.split(" ");
  const [, untilMonth] = until.split(" ");
  return fromMonth === untilMonth ? `${fromDay} → ${until}` : `${from} → ${until}`;
}

export interface RowBadge {
  readonly tone: "now" | "soon";
  readonly text: string;
}

/** La etiqueta de la lista: el que rige ahora, o el próximo (y cuántos más hay). */
export function rowBadge(schedules: ReadonlyArray<BusinessDataSchedule>, timeZone: string, now: Date): RowBadge | null {
  const open = schedules.filter((schedule) => scheduleState(schedule, now) !== "ended");
  const active = open.find((schedule) => scheduleState(schedule, now) === "active");
  if (active) return { tone: "now", text: `Ahora: ${active.note || "cambio programado"} · hasta el ${dayLabel(new Date(Date.parse(active.endsAt) - 1).toISOString(), timeZone)}` };
  const [next, ...rest] = open;
  if (!next) return null;
  return { tone: "soon", text: `${next.note || "Programado"} · ${shortRange(next, timeZone)}${rest.length ? ` · +${rest.length} más` : ""}` };
}

/** Las difusiones programadas que salen mientras rige el cambio: dirán ese valor. */
export function broadcastsDuring(uses: ReadonlyArray<BusinessDataUse>, schedule: Range): Array<{ readonly name: string; readonly sendAt: string }> {
  const [from, until] = [Date.parse(schedule.startsAt), Date.parse(schedule.endsAt)];
  return uses.flatMap((use) => (use.kind === "broadcast" && use.sendAt && Date.parse(use.sendAt) >= from && Date.parse(use.sendAt) < until ? [{ name: use.name, sendAt: use.sendAt }] : []));
}
