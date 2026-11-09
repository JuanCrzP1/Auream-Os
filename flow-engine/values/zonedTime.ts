// ---------------------------------------------------------------------------
// Fecha y hora «de pared» de una zona horaria → instante UTC. Pura.
//
// Un comprobante dice «8 nov 2026, 10:35 a. m.» en la hora del país del
// negocio, no en la del servidor. Se resuelve con `Intl` (sin librerías):
// se estima el desfase de la zona en ese instante y se corrige una vez más
// para los cambios de horario.
// ---------------------------------------------------------------------------

export interface WallClock {
  readonly year: number;
  /** 1–12. */
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function offsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Instante en que el reloj de `timezone` marca `clock`. Zona inválida → UTC. */
export function zonedToInstant(clock: WallClock, timezone: string): Date {
  const naive = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  try {
    let instant = naive - offsetMs(naive, timezone);
    instant = naive - offsetMs(instant, timezone);
    return new Date(instant);
  } catch {
    return new Date(naive);
  }
}

/** ¿Existe ese día en el calendario? (31 de febrero no). */
export function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Reloj de pared de `timezone` en ese instante, con el día de la semana (0 = domingo). Zona inválida → UTC. */
export function instantToZoned(instant: Date, timezone: string): WallClock & { readonly weekday: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(instant);
  } catch {
    return instantToZoned(instant, "UTC");
  }
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const clock = { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
  return { ...clock, weekday: new Date(Date.UTC(clock.year, clock.month - 1, clock.day)).getUTCDay() };
}
