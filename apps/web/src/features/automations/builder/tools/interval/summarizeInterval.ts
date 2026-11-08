import {
  isCompleteMoment,
  readIntervalConfig,
  type IntervalConfig,
  type IntervalSchedule,
  type IntervalUnit,
  type Weekday
} from "@contracts/IntervalConfig";
import type { ToolData } from "../ToolDefinition";
import { formatTime12 } from "./time12";
import {
  WEEKDAY_LABELS,
  activeDays,
  areDaysConsecutive,
  hasUniformRanges,
  sortRanges
} from "./intervalSchedule";

// ---------------------------------------------------------------------------
// El Programador en palabras. Puro y derivado.
//
// Dos longitudes de una misma lectura: `describeInterval` (corta, para el nodo)
// y `explainInterval` (larga, confirmación del editor). Primero el momento
// principal; después, solo si está activo, el horario. Las horas se dicen en
// 12 h, como en el editor.
// ---------------------------------------------------------------------------

const UNIT_NAMES: Readonly<Record<IntervalUnit, readonly [string, string]>> = {
  seconds: ["segundo", "segundos"],
  minutes: ["minuto", "minutos"],
  hours: ["hora", "horas"],
  days: ["día", "días"]
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** La hora en 12 h, o tal cual si aún no es una hora (no se disfraza lo incompleto). */
const as12 = (hhmm: string): string => formatTime12(hhmm) ?? hhmm;

/** «3 minutos», «1 hora». */
export function describeDuration(amount: number, unit: IntervalUnit): string {
  const [singular, plural] = UNIT_NAMES[unit];

  return `${amount} ${amount === 1 ? singular : plural}`;
}

/**
 * «25 sep 2026». Se lee la cadena, sin `Date`: construir un `Date` desde una
 * fecha de pared la interpreta en la zona del navegador y puede restar un día.
 */
function describeDate(date: string): string {
  const [year, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function describeRanges(schedule: IntervalSchedule, day: Weekday): string {
  const ranges = sortRanges(schedule[day].ranges).map((range) => `${as12(range.start)}–${as12(range.end)}`);

  if (ranges.length <= 1) return ranges.join("");

  return `${ranges.slice(0, -1).join(", ")} y ${ranges[ranges.length - 1]}`;
}

/** Días activos: «lunes a viernes» si son consecutivos; lista si no. */
function describeDays(schedule: IntervalSchedule): string {
  const days = activeDays(schedule);
  const name = (day: Weekday) => WEEKDAY_LABELS[day].toLowerCase();

  if (days.length === 0) return "";
  if (days.length === 1) return name(days[0]);
  if (areDaysConsecutive(schedule)) return `${name(days[0])} a ${name(days[days.length - 1])}`;

  const names = days.map(name);
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/** Frase corta del nodo cerrado. */
export function describeInterval(config: IntervalConfig): string {
  const moment = describeMoment(config);

  return config.scheduleEnabled ? `${moment} + horario permitido` : moment;
}

/**
 * Solo el momento principal. El nodo cerrado lo usa suelto porque el horario
 * ya viaja en su propia línea.
 */
export function describeMoment(config: IntervalConfig): string {
  if (config.trigger === "interval") {
    return `Esperar ${describeDuration(config.wait.amount, config.wait.unit)}`;
  }

  if (!isCompleteMoment(config.moment)) return "Sin fecha configurada";

  return `${describeDate(config.moment.date)} · ${as12(config.moment.time)}`;
}

/**
 * Frase larga de confirmación. `null` si aún no describe nada (sin fecha o
 * sin días): confirmar algo incompleto sería una confirmación falsa.
 */
export function explainInterval(config: IntervalConfig): string | null {
  const moment = explainMoment(config);
  if (moment === null) return null;

  if (!config.scheduleEnabled) return endSentence(moment);

  const schedule = explainSchedule(config);
  if (schedule === null) return null;

  return endSentence(`${moment}, ${schedule}`);
}

/** Punto final salvo si ya acaba en uno («p.m.»). */
const endSentence = (sentence: string): string => (sentence.endsWith(".") ? sentence : `${sentence}.`);

function explainMoment(config: IntervalConfig): string | null {
  if (config.trigger === "interval") {
    return `La conversación continuará ${describeDuration(
      config.wait.amount,
      config.wait.unit
    )} después de llegar a este bloque`;
  }

  if (!isCompleteMoment(config.moment)) return null;

  return `La conversación quedará en espera hasta el ${describeDate(config.moment.date)} a las ${as12(
    config.moment.time
  )}`;
}

function explainSchedule(config: IntervalConfig): string | null {
  const days = activeDays(config.schedule);
  if (days.length === 0) return null;

  const dayText = describeDays(config.schedule);

  if (!hasUniformRanges(config.schedule)) {
    return `y solo dentro del horario configurado de ${dayText}`;
  }

  return `y solo de ${dayText}, entre ${describeRanges(config.schedule, days[0])}`;
}

export function summarizeInterval(_content: ToolData, config: ToolData): string {
  return describeInterval(readIntervalConfig(config));
}
