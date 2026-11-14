import type { BusinessDataType } from "../../../contracts/BusinessDataContracts";
import { BUSINESS_SCHEDULE_LIMITS as LIMITS, scheduleState, type BusinessDataSchedule } from "../../../contracts/BusinessDataTimeline";
import { isRealDate, zonedToInstant } from "../../../flow-engine/values/zonedTime";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { requireValue } from "./BusinessDatum";

// ---------------------------------------------------------------------------
// Un cambio programado de un dato del negocio y sus reglas (puras):
//
//   · las fechas se eligen en la zona del NEGOCIO; «desde» en el pasado es
//     «desde ya»; «hasta» va después, y a lo sumo un año adelante
//   · el valor tiene el tipo del dato y no es igual al de siempre
//   · dos cambios del mismo dato no se cruzan; hasta 10 por venir o activos
//   · uno que no ha empezado se edita entero; uno activo, todo menos «desde»
//     (ya empezó); uno terminado ya no se toca
// ---------------------------------------------------------------------------

export interface ScheduleShape {
  readonly value: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly note: string;
}

type ScheduleInput = { readonly value?: unknown; readonly from?: unknown; readonly until?: unknown; readonly note?: unknown };

export interface ScheduleContext {
  readonly type: BusinessDataType;
  /** El valor de siempre, ya guardado. */
  readonly baseValue: string;
  readonly timezone: string;
  readonly now: Date;
  /** Los otros cambios del dato que no han terminado (sin el que se edita). */
  readonly others: ReadonlyArray<BusinessDataSchedule>;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** El instante de `{ date, time }` en la zona del negocio. */
function requireWhen(when: unknown, which: "desde" | "hasta", timezone: string): Date {
  const parts = when !== null && typeof when === "object" ? (when as { date?: unknown; time?: unknown }) : {};
  const date = typeof parts.date === "string" ? DATE.exec(parts.date.trim()) : null;
  const time = typeof parts.time === "string" ? TIME.exec(parts.time.trim()) : null;
  if (!date || !isRealDate(Number(date[1]), Number(date[2]), Number(date[3]))) throw new ValidationError(`Elige la fecha «${which}».`);
  if (!time) throw new ValidationError(`Elige la hora «${which}».`);
  return zonedToInstant({ year: Number(date[1]), month: Number(date[2]), day: Number(date[3]), hour: Number(time[1]), minute: Number(time[2]), second: 0 }, timezone);
}

function requireNote(value: unknown): string {
  const note = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (note.length > LIMITS.maxNote) throw new ValidationError(`La nota admite hasta ${LIMITS.maxNote} caracteres.`);
  return note;
}

/** «24 dic, 8:00 a. m.» en la hora del negocio. */
export function momentText(at: Date | string, timezone: string): string {
  const instant = typeof at === "string" ? new Date(at) : at;
  try {
    return new Intl.DateTimeFormat("es", { timeZone: timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(instant).replace(/\./g, "");
  } catch {
    return instant.toISOString().slice(0, 16).replace("T", " ");
  }
}

function requireNoOverlap(shape: ScheduleShape, context: ScheduleContext): void {
  const clash = context.others.find((other) => shape.startsAt.getTime() < Date.parse(other.endsAt) && Date.parse(other.startsAt) < shape.endsAt.getTime());
  if (!clash) return;
  const name = clash.note ? `«${clash.note}» ` : "otro cambio ";
  throw new ValidationError(`Se cruza con ${name}(${momentText(clash.startsAt, context.timezone)} → ${momentText(clash.endsAt, context.timezone)}). Cambia las fechas o quita ese cambio.`);
}

function requireRange(startsAt: Date, endsAt: Date, now: Date): void {
  if (endsAt.getTime() - Math.max(startsAt.getTime(), now.getTime()) < MINUTE_MS) {
    throw new ValidationError(endsAt.getTime() <= now.getTime() ? "«Hasta» ya pasó: elige una fecha más adelante." : "«Hasta» va después de «desde».");
  }
  if (endsAt.getTime() - now.getTime() > LIMITS.maxDaysAhead * DAY_MS) throw new ValidationError("Se puede programar hasta un año adelante.");
}

function requireDifferent(value: string, context: ScheduleContext): void {
  if (value === context.baseValue) throw new ValidationError("Es el mismo valor de siempre: escribe el que va mientras dura el cambio.");
}

/** Un cambio nuevo, validado. «Desde» en el pasado empieza ya. */
export function requireNewSchedule(input: ScheduleInput, context: ScheduleContext): ScheduleShape {
  if (context.others.length >= LIMITS.maxOpen) throw new ValidationError(`Un dato admite hasta ${LIMITS.maxOpen} cambios programados a la vez. Quita alguno que ya no vaya.`);
  const value = requireValue(context.type, input.value);
  requireDifferent(value, context);
  const from = requireWhen(input.from, "desde", context.timezone);
  const endsAt = requireWhen(input.until, "hasta", context.timezone);
  const startsAt = from.getTime() < context.now.getTime() ? context.now : from;
  requireRange(startsAt, endsAt, context.now);
  const shape = { value, startsAt, endsAt, note: requireNote(input.note) };
  requireNoOverlap(shape, context);
  return shape;
}

/** Cambios a uno que existe: lo que no viene queda igual; si ya empezó, «desde» no se mueve. */
export function requireScheduleChanges(current: BusinessDataSchedule, input: ScheduleInput, context: ScheduleContext): ScheduleShape {
  const state = scheduleState(current, context.now);
  if (state === "ended") throw new ValidationError("Ese cambio ya terminó: programa uno nuevo.");
  const value = input.value === undefined ? current.value : requireValue(context.type, input.value);
  requireDifferent(value, context);
  const from = state === "active" || input.from === undefined ? new Date(current.startsAt) : requireWhen(input.from, "desde", context.timezone);
  const startsAt = state === "upcoming" && from.getTime() < context.now.getTime() ? context.now : from;
  const endsAt = input.until === undefined ? new Date(current.endsAt) : requireWhen(input.until, "hasta", context.timezone);
  requireRange(startsAt, endsAt, context.now);
  const shape = { value, startsAt, endsAt, note: input.note === undefined ? current.note : requireNote(input.note) };
  requireNoOverlap(shape, context);
  return shape;
}

/** Quitar uno: si no ha empezado se borra; si ya rige, termina ahora (el valor de siempre vuelve ya). */
export function removalOf(current: BusinessDataSchedule, now: Date): "unscheduled" | "ended" {
  const state = scheduleState(current, now);
  if (state === "ended") throw new ValidationError("Ese cambio ya terminó.");
  return state === "upcoming" ? "unscheduled" : "ended";
}
