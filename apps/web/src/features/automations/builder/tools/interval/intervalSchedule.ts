import {
  SCHEDULE_DEFAULT_RANGE,
  WEEKDAYS,
  minutesOfDay,
  type IntervalSchedule,
  type ScheduleRange,
  type Weekday
} from "@contracts/IntervalConfig";

// ---------------------------------------------------------------------------
// Gestos del editor sobre el horario. Puros: reciben un horario y devuelven
// otro, sin mutarlo. No suben al contrato porque el motor no los ejecuta.
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo"
};

function withDay(
  schedule: IntervalSchedule,
  day: Weekday,
  ranges: ReadonlyArray<ScheduleRange>,
  enabled: boolean
): IntervalSchedule {
  return { ...schedule, [day]: { enabled, ranges } };
}

/**
 * Enciende o apaga un día. Al encender un día vacío se propone una franja (un
 * día activo sin horas no significa nada). Al apagar se conservan las franjas.
 */
export function toggleDay(schedule: IntervalSchedule, day: Weekday, enabled: boolean): IntervalSchedule {
  const current = schedule[day];
  const ranges = enabled && current.ranges.length === 0 ? [SCHEDULE_DEFAULT_RANGE] : current.ranges;

  return withDay(schedule, day, ranges, enabled);
}

export function addRange(schedule: IntervalSchedule, day: Weekday): IntervalSchedule {
  const current = schedule[day];

  return withDay(schedule, day, [...current.ranges, SCHEDULE_DEFAULT_RANGE], current.enabled);
}

/** Quita una franja. Quitar la última apaga el día: un día activo sin franjas es inválido. */
export function removeRange(schedule: IntervalSchedule, day: Weekday, index: number): IntervalSchedule {
  const current = schedule[day];
  const ranges = current.ranges.filter((_, i) => i !== index);

  return withDay(schedule, day, ranges, ranges.length === 0 ? false : current.enabled);
}

export function editRange(
  schedule: IntervalSchedule,
  day: Weekday,
  index: number,
  edge: "start" | "end",
  time: string
): IntervalSchedule {
  const current = schedule[day];
  const ranges = current.ranges.map((range, i) => (i === index ? { ...range, [edge]: time } : range));

  return withDay(schedule, day, ranges, current.enabled);
}

export function activeDays(schedule: IntervalSchedule): Weekday[] {
  return WEEKDAYS.filter((day) => schedule[day].enabled);
}

/** `true` si todos los días activos tienen las mismas franjas (para resumir «L–V, 09–18»). */
export function hasUniformRanges(schedule: IntervalSchedule): boolean {
  const days = activeDays(schedule);
  if (days.length < 2) return true;

  const signature = (day: Weekday) => schedule[day].ranges.map((r) => `${r.start}-${r.end}`).join("|");
  const first = signature(days[0]);

  return days.every((day) => signature(day) === first);
}

/** `true` si los días activos son consecutivos (para decir «de lunes a viernes»). */
export function areDaysConsecutive(schedule: IntervalSchedule): boolean {
  const indices = activeDays(schedule).map((day) => WEEKDAYS.indexOf(day));
  if (indices.length < 2) return true;

  return indices.every((value, i) => i === 0 || value === indices[i - 1] + 1);
}

/**
 * Franjas ordenadas por inicio. El editor no reordena mientras se escribe (la
 * fila se movería bajo el cursor); quien necesita el orden lo pide aquí.
 */
export function sortRanges(ranges: ReadonlyArray<ScheduleRange>): ScheduleRange[] {
  return [...ranges].sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start));
}
