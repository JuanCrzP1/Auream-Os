// ---------------------------------------------------------------------------
// Configuración del «Programador» (nodo `delay`).
//
// Vive en `contracts/` porque la leerá el motor: `DelayNodeHandler` aparca la
// sesión en `delayed` y, cuando exista la cola (Fase C), interpretará esto.
// Puro: sin React ni Node.
//
// Fuera de alcance, a propósito:
//   · Zona horaria. Se guarda HORA DE PARED («2026-09-25», «14:30»), no un
//     instante: la plataforma aún no tiene `tenant.timezone`. La conversión se
//     añadirá en el runtime sin migrar nodos.
//   · Horarios de funcionamiento del negocio: no existe esa fuente todavía.
// ---------------------------------------------------------------------------

/**
 * Momento principal, excluyente: una espera relativa o una cita absoluta. El
 * horario no es un tercer momento sino una restricción sobre el elegido.
 */
export type IntervalTrigger = "interval" | "date";

/** Modelo anterior, con `mode` de tres valores. El lector lo traduce. */
type LegacyMode = "interval" | "date" | "schedule";

export type IntervalUnit = "seconds" | "minutes" | "hours" | "days";

export interface IntervalWait {
  readonly amount: number;
  readonly unit: IntervalUnit;
}

/** `YYYY-MM-DD` y `HH:MM`: lo que producen `<input type="date|time">`. */
export interface IntervalMoment {
  readonly date: string;
  readonly time: string;
}

/** Franja `HH:MM`–`HH:MM`. */
export interface ScheduleRange {
  readonly start: string;
  readonly end: string;
}

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface ScheduleDay {
  readonly enabled: boolean;
  readonly ranges: ReadonlyArray<ScheduleRange>;
}

/** Siempre los siete días, aunque estén apagados. */
export type IntervalSchedule = Readonly<Record<Weekday, ScheduleDay>>;

/**
 * `trigger` decide CUÁNDO continuar; `schedule` (si `scheduleEnabled`) decide
 * cuándo NO se puede, y aplaza a la siguiente ventana. Así las combinaciones
 * imposibles no se pueden escribir.
 *
 * `wait` y `moment` conviven aunque solo uno gobierne: cambiar de modo para
 * mirar la otra opción no borra lo ya configurado.
 */
export interface IntervalConfig {
  readonly trigger: IntervalTrigger;
  readonly wait: IntervalWait;
  /** `null` mientras no se haya elegido fecha. No se inventa ninguna. */
  readonly moment: IntervalMoment | null;
  readonly scheduleEnabled: boolean;
  readonly schedule: IntervalSchedule;
}

const MS_PER_UNIT: Readonly<Record<IntervalUnit, number>> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000
};

/**
 * Tope de 31 días: más allá deja de ser una conversación y pasa a ser una
 * campaña. En ms para que «44.640 minutos» y «31 días» caigan igual.
 */
export const INTERVAL_MAX_WAIT_MS = 31 * MS_PER_UNIT.days;

/** Franja propuesta al encender un día. */
export const SCHEDULE_DEFAULT_RANGE: ScheduleRange = { start: "09:00", end: "18:00" };

/**
 * Semana construida día a día. Enumera los siete a mano para que el
 * compilador exija todos (con `Object.fromEntries` se perdería el tipo).
 */
function buildWeek(build: (day: Weekday) => ScheduleDay): IntervalSchedule {
  return {
    monday: build("monday"),
    tuesday: build("tuesday"),
    wednesday: build("wednesday"),
    thursday: build("thursday"),
    friday: build("friday"),
    saturday: build("saturday"),
    sunday: build("sunday")
  };
}

export const EMPTY_SCHEDULE: IntervalSchedule = buildWeek(() => ({ enabled: false, ranges: [] }));

/** Nace guardable: 5 minutos, sin fecha y con el horario apagado. */
export const INTERVAL_DEFAULT_CONFIG: IntervalConfig = {
  trigger: "interval",
  wait: { amount: 5, unit: "minutes" },
  moment: null,
  scheduleEnabled: false,
  schedule: EMPTY_SCHEDULE
};

export function isIntervalUnit(unit: unknown): unit is IntervalUnit {
  return unit === "seconds" || unit === "minutes" || unit === "hours" || unit === "days";
}

export function isIntervalTrigger(trigger: unknown): trigger is IntervalTrigger {
  return trigger === "interval" || trigger === "date";
}

function isLegacyMode(mode: unknown): mode is LegacyMode {
  return mode === "interval" || mode === "date" || mode === "schedule";
}

/** Entera y positiva. */
export function isIntervalAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount > 0;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Hora de pared `HH:MM` en 24 h. */
export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** Fecha `YYYY-MM-DD` que existe en el calendario (rechaza el 31 de febrero). */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const rebuilt = new Date(Date.UTC(year, month - 1, day));

  return (
    rebuilt.getUTCFullYear() === year &&
    rebuilt.getUTCMonth() === month - 1 &&
    rebuilt.getUTCDate() === day
  );
}

/** Minutos desde medianoche. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Espera del modo intervalo en ms; `null` en modo fecha. */
export function intervalWaitMs(config: IntervalConfig): number | null {
  if (config.trigger !== "interval") return null;

  return config.wait.amount * MS_PER_UNIT[config.wait.unit];
}

/**
 * Momento guardado, conservando una mitad escrita: el par se rellena en dos
 * gestos y descartarlo a medias impediría completarlo. `null` si no hay nada.
 */
function readMoment(moment: Record<string, unknown> | null): IntervalMoment | null {
  if (moment === null) return null;

  const date = typeof moment.date === "string" ? moment.date : "";
  const time = typeof moment.time === "string" ? moment.time : "";

  return date.length === 0 && time.length === 0 ? null : { date, time };
}

/** Guarda de tipo: el momento está completo y es legible. */
export function isCompleteMoment(moment: IntervalMoment | null): moment is IntervalMoment {
  return moment !== null && isValidDate(moment.date) && isValidTime(moment.time);
}

/** Hora de una franja: la hora, `""` si falta (a medio escribir) o `null` si es ilegible. */
function readRangeEdge(value: unknown): string | null {
  if (isValidTime(value)) return value;
  if (value === undefined || value === "") return "";

  return null;
}

/**
 * Franja suelta. Se conserva a medio escribir (para poder corregir una hora);
 * se descarta si alguna mitad es ilegible o si no tiene nada.
 */
function readRange(raw: unknown): ScheduleRange | null {
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;
  const start = readRangeEdge(record.start);
  const end = readRangeEdge(record.end);

  if (start === null || end === null) return null;

  return start.length === 0 && end.length === 0 ? null : { start, end };
}

function readDay(raw: unknown): ScheduleDay {
  if (typeof raw !== "object" || raw === null) return { enabled: false, ranges: [] };

  const record = raw as Record<string, unknown>;
  const ranges = Array.isArray(record.ranges)
    ? record.ranges.map(readRange).filter((range): range is ScheduleRange => range !== null)
    : [];

  return { enabled: record.enabled === true, ranges };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * Lee la configuración de un nodo `delay` sin confiar en ella.
 *
 * Responde «¿qué se puede pintar?»: lo corrupto cae al default y lo incompleto
 * se conserva. «¿Puede guardarse?» lo responde `validateInterval`.
 *
 * Traduce el modelo anterior (`mode`): `interval`/`date` eran momentos
 * principales; `schedule` pasa a ser la restricción, activa.
 */
export function readIntervalConfig(config: Readonly<Record<string, unknown>>): IntervalConfig {
  const wait = asRecord(config.wait) ?? {};
  const schedule = asRecord(config.schedule) ?? {};
  const legacy = isLegacyMode(config.mode) ? config.mode : null;

  const trigger = isIntervalTrigger(config.trigger)
    ? config.trigger
    : legacy === "date" || legacy === "interval"
      ? legacy
      : INTERVAL_DEFAULT_CONFIG.trigger;

  return {
    trigger,
    scheduleEnabled:
      typeof config.scheduleEnabled === "boolean" ? config.scheduleEnabled : legacy === "schedule",
    wait: {
      amount: isIntervalAmount(wait.amount) ? wait.amount : INTERVAL_DEFAULT_CONFIG.wait.amount,
      unit: isIntervalUnit(wait.unit) ? wait.unit : INTERVAL_DEFAULT_CONFIG.wait.unit
    },
    moment: readMoment(asRecord(config.moment)),
    schedule: buildWeek((day) => readDay(schedule[day]))
  };
}
