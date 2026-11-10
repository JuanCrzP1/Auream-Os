import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// El periodo del Dashboard en días de la EMPRESA y el periodo anterior del
// mismo largo (para «▲ 18 % frente al periodo anterior»).
// ---------------------------------------------------------------------------

export interface Period {
  /** Primer día y último día (incluido), `YYYY-MM-DD`. */
  readonly fromDay: string;
  readonly toDay: string;
  /** Instantes: desde la medianoche del primer día hasta la del día siguiente al último. */
  readonly from: Date;
  readonly until: Date;
  readonly days: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_DAYS = 366;

/** Desfase (ms) de la zona en ese instante: lo que marca su reloj leído como UTC, menos el instante. */
function offsetMs(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(at)
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) - Math.floor(at.getTime() / 1000) * 1000;
}

/** La medianoche de ese día en la zona de la empresa, como instante. */
export function startOfDay(day: string, timezone: string): Date {
  const utcMidnight = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return new Date(utcMidnight - offsetMs(new Date(utcMidnight), timezone));
}

export function todayIn(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const addDays = (day: string, n: number) => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + n)).toISOString().slice(0, 10);

/** El periodo pedido (por defecto, los últimos 30 días hasta hoy). */
export function periodOf(fromDay: string | undefined, toDay: string | undefined, timezone: string, now: Date): Period {
  const to = toDay && DAY.test(toDay) ? toDay : todayIn(now, timezone);
  const from = fromDay && DAY.test(fromDay) ? fromDay : addDays(to, -29);
  if (from > to) throw new ValidationError("La fecha inicial va antes de la final.");
  const days = Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / DAY_MS) + 1;
  if (days > MAX_DAYS) throw new ValidationError("Elige un periodo de hasta un año.");
  return { fromDay: from, toDay: to, from: startOfDay(from, timezone), until: startOfDay(addDays(to, 1), timezone), days };
}

/** El mismo largo, justo antes. */
export function previousPeriod(period: Period, timezone: string): Period {
  const toDay = addDays(period.fromDay, -1);
  const fromDay = addDays(toDay, -(period.days - 1));
  return { fromDay, toDay, from: startOfDay(fromDay, timezone), until: startOfDay(addDays(toDay, 1), timezone), days: period.days };
}

/** Cambio relativo (0.18 = +18 %); `null` si antes era cero. */
export function change(value: number, previous: number): number | null {
  return previous > 0 ? (value - previous) / previous : null;
}
