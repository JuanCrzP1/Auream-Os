import {
  INTERVAL_MAX_WAIT_MS,
  WEEKDAYS,
  intervalWaitMs,
  isIntervalAmount,
  isIntervalTrigger,
  isIntervalUnit,
  isValidDate,
  isValidTime,
  minutesOfDay,
  readIntervalConfig
} from "@contracts/IntervalConfig";
import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";

export const UNKNOWN_TRIGGER_MESSAGE = "Elige cuándo debe continuar la conversación.";

export const INVALID_AMOUNT_MESSAGE = "La espera debe ser un número entero mayor que cero.";

export const INVALID_INTERVAL_UNIT_MESSAGE = "Elige segundos, minutos, horas o días.";

export const WAIT_TOO_LONG_MESSAGE =
  "La espera no puede superar los 31 días. Para pausas más largas, usa una fecha.";

export const INCOMPLETE_DATE_MESSAGE = "Elige la fecha y la hora en las que continuar.";

export const INVALID_DATE_MESSAGE = "Esa fecha no existe. Revisa el día y el mes.";

export const INVALID_TIME_MESSAGE = "Escribe una hora válida, por ejemplo 14:45.";

export const NO_ACTIVE_DAYS_MESSAGE = "Activa al menos un día para que la conversación pueda continuar.";

export const DAY_WITHOUT_RANGES_MESSAGE = "Un día activo necesita al menos un horario.";

export const INVERTED_RANGE_MESSAGE = "La hora de fin debe ser posterior a la de inicio.";

/**
 * ¿Puede guardarse este Programador?
 *
 * Valida el momento principal elegido (el otro puede estar a medias: no
 * gobierna) y, si está activo, el horario. Mira el config CRUDO, porque el
 * lector conserva datos incompletos para poder pintarlos.
 */
export function validateInterval(_content: ToolData, config: ToolData): ValidationResult {
  if (config.trigger !== undefined && !isIntervalTrigger(config.trigger)) {
    return invalid(UNKNOWN_TRIGGER_MESSAGE);
  }

  const read = readIntervalConfig(config);
  const moment = read.trigger === "interval" ? validateWait(config) : validateDate(config);
  if (!moment.valid) return moment;

  return read.scheduleEnabled ? validateSchedule(config) : VALID;
}

function validateWait(config: ToolData): ValidationResult {
  const raw = config.wait;
  // Ausente: el lector aplica el default, que es válido.
  if (raw === undefined) return VALID;
  if (typeof raw !== "object" || raw === null) return invalid(INVALID_AMOUNT_MESSAGE);

  const wait = raw as Record<string, unknown>;
  if (!isIntervalAmount(wait.amount)) return invalid(INVALID_AMOUNT_MESSAGE);
  if (!isIntervalUnit(wait.unit)) return invalid(INVALID_INTERVAL_UNIT_MESSAGE);

  const ms = intervalWaitMs({ ...readIntervalConfig(config), trigger: "interval" });
  if (ms !== null && ms > INTERVAL_MAX_WAIT_MS) return invalid(WAIT_TOO_LONG_MESSAGE);

  return VALID;
}

function validateDate(config: ToolData): ValidationResult {
  const raw = config.moment;
  if (typeof raw !== "object" || raw === null) return invalid(INCOMPLETE_DATE_MESSAGE);

  const moment = raw as Record<string, unknown>;
  const hasDate = typeof moment.date === "string" && moment.date.length > 0;
  const hasTime = typeof moment.time === "string" && moment.time.length > 0;

  if (!hasDate || !hasTime) return invalid(INCOMPLETE_DATE_MESSAGE);
  if (!isValidDate(moment.date)) return invalid(INVALID_DATE_MESSAGE);
  if (!isValidTime(moment.time)) return invalid(INVALID_TIME_MESSAGE);

  return VALID;
}

function validateSchedule(config: ToolData): ValidationResult {
  const raw = config.schedule;
  const schedule = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  let anyActive = false;

  for (const day of WEEKDAYS) {
    const rawDay = schedule[day];
    if (typeof rawDay !== "object" || rawDay === null) continue;

    const { enabled, ranges } = rawDay as Record<string, unknown>;
    if (enabled !== true) continue;

    anyActive = true;

    if (!Array.isArray(ranges) || ranges.length === 0) return invalid(DAY_WITHOUT_RANGES_MESSAGE);

    for (const rawRange of ranges) {
      if (typeof rawRange !== "object" || rawRange === null) return invalid(INVALID_TIME_MESSAGE);

      const { start, end } = rawRange as Record<string, unknown>;
      if (!isValidTime(start) || !isValidTime(end)) return invalid(INVALID_TIME_MESSAGE);
      if (minutesOfDay(end) <= minutesOfDay(start)) return invalid(INVERTED_RANGE_MESSAGE);
    }
  }

  return anyActive ? VALID : invalid(NO_ACTIVE_DAYS_MESSAGE);
}
