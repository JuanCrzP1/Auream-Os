import {
  intervalWaitMs,
  isCompleteMoment,
  isValidTime,
  minutesOfDay,
  WEEKDAYS,
  type IntervalConfig,
  type ScheduleRange,
  type Weekday
} from "../../contracts/IntervalConfig";
import { instantToZoned, zonedToInstant } from "../values/zonedTime";

// ---------------------------------------------------------------------------
// ¿Cuándo sigue el flujo después de un Programador? Pura.
//
//   1. El momento principal: una espera relativa («3 minutos») o una fecha y
//      hora exactas en la zona del negocio (si ya pasó, sigue ya).
//   2. El horario, si está activo: si ese momento cae fuera de las franjas
//      permitidas, se aplaza al inicio de la siguiente franja.
//
// `null`: la configuración no permite calcularlo (fecha a medio escribir).
// ---------------------------------------------------------------------------

/** `getUTCDay()` (0 = domingo) → clave del horario. */
const WEEKDAY_BY_JS_DAY: ReadonlyArray<Weekday> = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** Basta con mirar una semana y un día: después las franjas se repiten. */
const SEARCH_DAYS = 8;

function principalMoment(config: IntervalConfig, now: Date, timezone: string): Date | null {
  if (config.trigger === "interval") {
    const wait = intervalWaitMs(config);
    return wait === null ? null : new Date(now.getTime() + wait);
  }
  if (!isCompleteMoment(config.moment)) return null;
  const [year, month, day] = config.moment.date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = config.moment.time.split(":").map(Number) as [number, number];
  const at = zonedToInstant({ year, month, day, hour, minute, second: 0 }, timezone);
  return at.getTime() > now.getTime() ? at : now;
}

function validRanges(ranges: ReadonlyArray<ScheduleRange>): ScheduleRange[] {
  return ranges
    .filter((range) => isValidTime(range.start) && isValidTime(range.end) && minutesOfDay(range.end) > minutesOfDay(range.start))
    .sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start));
}

/** Primer instante ≥ `from` dentro de una franja del horario; `from` si el horario no tiene franjas válidas. */
function nextAllowed(config: IntervalConfig, from: Date, timezone: string): Date {
  const days = WEEKDAYS.filter((day) => config.schedule[day].enabled && validRanges(config.schedule[day].ranges).length > 0);
  if (days.length === 0) return from;

  const start = instantToZoned(from, timezone);
  for (let offset = 0; offset < SEARCH_DAYS; offset += 1) {
    const date = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const weekday = WEEKDAY_BY_JS_DAY[date.getUTCDay()]!;
    if (!config.schedule[weekday].enabled) continue;
    for (const range of validRanges(config.schedule[weekday].ranges)) {
      const at = (time: string) => {
        const [hour, minute] = time.split(":").map(Number) as [number, number];
        return zonedToInstant({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour, minute, second: 0 }, timezone);
      };
      const windowStart = at(range.start);
      const windowEnd = at(range.end);
      if (from.getTime() >= windowEnd.getTime()) continue;
      return from.getTime() >= windowStart.getTime() ? from : windowStart;
    }
  }
  return from;
}

export function resolveResumeAt(config: IntervalConfig, now: Date, timezone: string): Date | null {
  const moment = principalMoment(config, now, timezone);
  if (moment === null) return null;
  return config.scheduleEnabled ? nextAllowed(config, moment, timezone) : moment;
}
