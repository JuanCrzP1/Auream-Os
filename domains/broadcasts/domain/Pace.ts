import { PACE_SECONDS, WARMUP_DAILY_CAPS, type BroadcastPace, type BroadcastSettings } from "../../../contracts/BroadcastContracts";

// ---------------------------------------------------------------------------
// El ritmo que cuida un número de WhatsApp:
//   · una pausa al azar entre un mensaje y el siguiente (nunca un patrón fijo)
//   · solo dentro del horario del negocio
//   · un máximo por número y por día, más bajo los primeros días que el número
//     envía difusiones (calentamiento)
// Todo con el reloj del negocio (su zona horaria).
// ---------------------------------------------------------------------------

export type Random = () => number;

/** Cuánto esperar antes del siguiente mensaje. */
export function nextDelayMs(pace: BroadcastPace, random: Random = Math.random): number {
  const [min, max] = PACE_SECONDS[pace];
  return Math.round((min + random() * (max - min)) * 1000);
}

interface LocalTime {
  /** Inicio del día del negocio (UTC). */
  readonly dayStart: Date;
  /** Hora local con fracción (13,5 = 1:30 p. m.). */
  readonly hour: number;
}

export function localTime(now: Date, timezone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(now)
    .reduce<Record<string, number>>((acc, part) => (part.type === "literal" ? acc : { ...acc, [part.type]: Number(part.value) }), {});
  const wall = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!);
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
  const dayStart = new Date(Date.UTC(parts.year!, parts.month! - 1, parts.day!) - offset);
  return { dayStart, hour: parts.hour! + parts.minute! / 60 + parts.second! / 3600 };
}

/** ¿Se puede enviar ahora? Si no, cuándo abre el horario. */
export function sendingWindow(now: Date, timezone: string, settings: Pick<BroadcastSettings, "fromHour" | "toHour">): { readonly open: boolean; readonly opensAt: Date } {
  const { dayStart, hour } = localTime(now, timezone);
  if (hour >= settings.fromHour && hour < settings.toHour) return { open: true, opensAt: now };
  const day = hour < settings.fromHour ? dayStart : new Date(dayStart.getTime() + 86_400_000);
  return { open: false, opensAt: new Date(day.getTime() + settings.fromHour * 3_600_000) };
}

/** Cuándo abre el horario de mañana (se llegó al tope de hoy). */
export function tomorrowOpens(now: Date, timezone: string, fromHour: number): Date {
  return new Date(localTime(now, timezone).dayStart.getTime() + 86_400_000 + fromHour * 3_600_000);
}

/**
 * Día de calentamiento (1–7) según cuántos días distintos ya envió difusiones
 * el número; `null` cuando ya terminó.
 */
export function warmupDay(daysWithSends: number): number | null {
  return daysWithSends < WARMUP_DAILY_CAPS.length ? daysWithSends + 1 : null;
}

/** El tope de hoy para un número: el de la difusión, o menos si está calentando. */
export function capToday(dailyCap: number, daysWithSends: number, sentEarlierToday: boolean): number {
  // Hoy ya cuenta como día de envío si salió algo: el tope no sube a mitad del día.
  const day = warmupDay(sentEarlierToday ? Math.max(0, daysWithSends - 1) : daysWithSends);
  return day === null ? dailyCap : Math.min(dailyCap, WARMUP_DAILY_CAPS[day - 1]!);
}

/** Cuántos días tarda, con el tope de cada número y su calentamiento. */
export function estimateDays(perNumber: ReadonlyArray<{ readonly count: number; readonly daysWithSends: number }>, dailyCap: number): number {
  return perNumber.reduce((longest, number) => {
    let left = number.count;
    let days = 0;
    while (left > 0 && days < 365) {
      left -= capToday(dailyCap, number.daysWithSends + days, false);
      days += 1;
    }
    return Math.max(longest, days);
  }, 0);
}

/** Inicio del mes del negocio (UTC). */
export function startOfMonth(now: Date, timezone: string): Date {
  const { dayStart } = localTime(now, timezone);
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, day: "numeric" }).format(now));
  return new Date(dayStart.getTime() - (day - 1) * 86_400_000);
}
