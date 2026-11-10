import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// El periodo de un filtro de ventas («del 1 al 30 de noviembre») en la zona
// horaria de la EMPRESA: una venta de las 11 p. m. en Bogotá es de ese día,
// aunque en UTC ya sea el siguiente.
// ---------------------------------------------------------------------------

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Minutos que la zona va adelantada (o atrasada) respecto de UTC en ese instante. */
function offsetMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** El instante en que empieza ese día (`YYYY-MM-DD`) en esa zona. */
export function startOfDay(date: string, timezone: string): Date {
  const match = DATE.exec(date);
  if (!match) throw new ValidationError("La fecha debe tener la forma AAAA-MM-DD.");
  const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(guess)) throw new ValidationError("La fecha no es válida.");
  // Dos pasadas: la segunda corrige si el cambio de horario cae justo ese día.
  const first = guess - offsetMinutes(new Date(guess), timezone) * 60_000;
  return new Date(guess - offsetMinutes(new Date(first), timezone) * 60_000);
}

/** El periodo [desde, hasta) en instantes; `hasta` es el comienzo del día siguiente al indicado. */
export function salePeriod(from: string | undefined, to: string | undefined, timezone: string): { from: Date | null; until: Date | null } {
  const start = from ? startOfDay(from, timezone) : null;
  let until: Date | null = null;
  if (to) {
    const match = DATE.exec(to);
    if (!match) throw new ValidationError("La fecha debe tener la forma AAAA-MM-DD.");
    const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1)).toISOString().slice(0, 10);
    until = startOfDay(next, timezone);
  }
  if (start && until && start >= until) throw new ValidationError("La fecha inicial debe ser anterior a la final.");
  return { from: start, until };
}
