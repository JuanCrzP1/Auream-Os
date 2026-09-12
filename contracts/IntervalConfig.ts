// ---------------------------------------------------------------------------
// Configuración de la herramienta «Intervalo» (nodo `delay`).
//
// POR QUÉ VIVE AQUÍ Y NO EN LA CARPETA DE LA HERRAMIENTA
//
// Por la misma razón que `WaitResponseConfig`: su forma la leen las dos
// orillas. `DelayNodeHandler` no es un handler de mentira —aparca la sesión en
// `delayed` de verdad, y `ExecutionLoop` lo respeta—, así que lo que el editor
// escriba aquí es lo que el motor tendrá que interpretar. `contracts/` es la
// única ruta compartida entre `apps/web` y el backend, y un tipo declarado en
// `tools/interval/` sería invisible para el motor.
//
// Compárese con Distribuidor, cuyo modelo SÍ vive en su carpeta: su handler
// falla con `not_implemented` y no abre la configuración. Cuando la forma no
// cruza al motor, no sube aquí. Esta cruza.
//
// PURO: sin React, sin Node, sin dependencias. Lo importan un componente de
// navegador y —cuando exista la cola— un handler de servidor.
//
// LO QUE ESTE CONTRATO NO RESUELVE, Y ES DELIBERADO
//
//   · LA ZONA HORARIA. Una fecha y un horario solo significan algo dentro de
//     una zona, y la plataforma todavía no tiene ese dato: un tenant es hoy
//     `tenantId`/`tenantKey`/`tenantName`/`role` y nada más. Así que aquí se
//     guarda HORA DE PARED —«2026-09-25», «14:30»— y NO un instante: convertir
//     a instante sin zona sería elegir una por el usuario y escribirla en
//     disco. El día que exista `tenant.timezone`, la conversión se añade en el
//     runtime sin migrar un solo nodo guardado.
//   · LOS HORARIOS DE FUNCIONAMIENTO. No existe ninguna fuente de horarios en
//     el producto, así que no se ofrece «usar los horarios de funcionamiento»:
//     sería un interruptor que no apunta a nada. Cuando esa fuente exista, el
//     horario aprende a leerla y el resto del contrato no se mueve.
// ---------------------------------------------------------------------------

/**
 * El MOMENTO PRINCIPAL: qué decide cuándo continúa la conversación.
 *
 * Son dos y son excluyentes —una espera relativa o una cita absoluta—, porque
 * un nodo no puede tener dos momentos principales a la vez. El horario NO está
 * aquí: no es un tercer momento, es una restricción que se aplica sobre el que
 * se elija. Ver `IntervalConfig`.
 */
export type IntervalTrigger = "interval" | "date";

/**
 * Compatibilidad hacia atrás.
 *
 * La primera versión de esta herramienta modelaba TRES modos equivalentes
 * —`interval`, `date`, `schedule`— y guardaba el elegido en `mode`. Era un
 * modelo equivocado: el horario nunca fue un momento principal. El lector
 * sigue entendiendo esos nodos y los traduce; ninguno hay que migrar a mano.
 */
type ModoHeredado = "interval" | "date" | "schedule";

/** Unidades en las que se expresa una espera. */
export type IntervalUnit = "seconds" | "minutes" | "hours" | "days";

/** Cuánto se espera, en el modo «después de un intervalo». */
export interface IntervalWait {
  readonly amount: number;
  readonly unit: IntervalUnit;
}

/**
 * El momento exacto en el que continuar, en el modo «en una fecha».
 *
 * HORA DE PARED, NO UN INSTANTE. `date` es `YYYY-MM-DD` y `time` es `HH:MM`,
 * los dos formatos que producen `<input type="date">` y `<input type="time">`
 * sin ninguna conversión por medio. Ver la nota sobre zona horaria arriba.
 */
export interface IntervalMoment {
  readonly date: string;
  readonly time: string;
}

/** Una franja del día: de `start` a `end`, ambos `HH:MM`. */
export interface ScheduleRange {
  readonly start: string;
  readonly end: string;
}

/** Los días de la semana, en el orden en que se leen. */
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

/** Un día del horario: encendido o no, y sus franjas. */
export interface ScheduleDay {
  readonly enabled: boolean;
  readonly ranges: ReadonlyArray<ScheduleRange>;
}

/** La semana completa. Siempre los siete días, aunque estén apagados. */
export type IntervalSchedule = Readonly<Record<Weekday, ScheduleDay>>;

/**
 * Lo que el usuario configura en un nodo «Programador».
 *
 * DOS PIEZAS CON PAPELES DISTINTOS, y esto es la regla de negocio entera:
 *
 *   · `trigger` es el MOMENTO PRINCIPAL y siempre existe. O se espera un rato
 *     (`interval`, con `wait`) o se espera hasta una cita (`date`, con
 *     `moment`). Son excluyentes: no hay nodo con dos momentos principales.
 *
 *   · `schedule` es una RESTRICCIÓN OPCIONAL que se aplica ENCIMA del momento
 *     calculado: si cae fuera de las ventanas permitidas, se espera a la
 *     siguiente. No decide cuándo continuar, decide cuándo NO se puede.
 *
 * Modelarlo así hace que las combinaciones imposibles no se puedan ni escribir:
 * «después + fecha» no existe porque `trigger` es uno solo, y «horario a secas»
 * no existe porque siempre hay `trigger`. Lo que antes había que rechazar
 * validando, ahora no se puede representar.
 *
 * LOS DOS MOMENTOS CONVIVEN EN EL DATO aunque solo uno gobierne: cambiar de
 * `interval` a `date` para mirar la otra opción no borra lo ya configurado en
 * la primera. Recuperarlo de otro modo exigiría una memoria paralela en el
 * editor, que es una segunda fuente de verdad.
 */
export interface IntervalConfig {
  readonly trigger: IntervalTrigger;
  readonly wait: IntervalWait;
  /** `null` mientras no se haya elegido una fecha. No se inventa ninguna. */
  readonly moment: IntervalMoment | null;
  /** `true` cuando la restricción horaria se aplica de verdad. */
  readonly scheduleEnabled: boolean;
  readonly schedule: IntervalSchedule;
}

/** Milisegundos de una unidad. Una sola aritmética para todo el producto. */
const MS_POR_UNIDAD: Readonly<Record<IntervalUnit, number>> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000
};

/**
 * Tope de una espera: 31 días.
 *
 * No sale de un capricho ni de copiar a nadie: por encima de un mes la espera
 * deja de ser parte de una conversación y pasa a ser una campaña, que es otra
 * herramienta. Se expresa en milisegundos para que el límite sea el mismo se
 * escriba en segundos o en días — 44.640 minutos y 31 días son la misma espera
 * y las dos tienen que caber o no caber a la vez.
 */
export const INTERVAL_MAX_WAIT_MS = 31 * MS_POR_UNIDAD.days;

/** Franja que se propone al encender un día. El usuario la ajusta. */
export const SCHEDULE_DEFAULT_RANGE: ScheduleRange = { start: "09:00", end: "18:00" };

/**
 * Construye una semana preguntando por cada día.
 *
 * ENUMERA LOS SIETE A MANO, y es deliberado: con `Object.fromEntries` el tipo
 * de las claves se pierde y haría falta un cast que apagaría la comprobación
 * justo donde importa. Así el compilador exige que estén los siete, y el día
 * que alguien añada un octavo a `Weekday` esto deja de compilar en lugar de
 * devolver una semana incompleta en silencio.
 */
function semanaDe(construir: (dia: Weekday) => ScheduleDay): IntervalSchedule {
  return {
    monday: construir("monday"),
    tuesday: construir("tuesday"),
    wednesday: construir("wednesday"),
    thursday: construir("thursday"),
    friday: construir("friday"),
    saturday: construir("saturday"),
    sunday: construir("sunday")
  };
}

/** Semana entera apagada: el punto de partida del modo horarios. */
export const EMPTY_SCHEDULE: IntervalSchedule = semanaDe(() => ({
  enabled: false,
  ranges: []
}));

/**
 * Configuración con la que nace un nodo «Intervalo».
 *
 * Nace en modo intervalo y con una espera ya puesta, para que el nodo sea
 * guardable desde el primer momento sin que el usuario tenga que rellenar nada.
 * La fecha nace en `null` —no se inventa un día— y el horario, apagado.
 */
export const INTERVAL_DEFAULT_CONFIG: IntervalConfig = {
  trigger: "interval",
  wait: { amount: 5, unit: "minutes" },
  moment: null,
  scheduleEnabled: false,
  schedule: EMPTY_SCHEDULE
};

/** `true` si la unidad es una de las cuatro que la herramienta ofrece. */
export function esUnidadDeIntervalo(unit: unknown): unit is IntervalUnit {
  return unit === "seconds" || unit === "minutes" || unit === "hours" || unit === "days";
}

/** `true` si el momento principal es uno de los dos que existen. */
export function esTriggerDeIntervalo(trigger: unknown): trigger is IntervalTrigger {
  return trigger === "interval" || trigger === "date";
}

/** `true` si es uno de los tres modos que guardaba la versión anterior. */
function esModoHeredado(mode: unknown): mode is ModoHeredado {
  return mode === "interval" || mode === "date" || mode === "schedule";
}

/**
 * `true` si la cantidad es una espera expresable: entera y positiva.
 *
 * Entera porque ningún control ofrece «2,5 horas»; positiva porque una espera
 * de cero no es una espera —es no tener el nodo—.
 */
export function esCantidadDeIntervalo(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isInteger(amount) && amount > 0;
}

/** Hora de pared `HH:MM` en 24h. Es lo que produce `<input type="time">`. */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Fecha `YYYY-MM-DD`. Es lo que produce `<input type="date">`. */
const FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** `true` si es una hora de pared legible. */
export function esHoraValida(value: unknown): value is string {
  return typeof value === "string" && HORA.test(value);
}

/**
 * `true` si es una fecha del calendario, y existe de verdad.
 *
 * El patrón por sí solo deja pasar el 31 de febrero, así que además se
 * reconstruye: si el `Date` no vuelve al mismo día, esa fecha no existe.
 */
export function esFechaValida(value: unknown): value is string {
  if (typeof value !== "string" || !FECHA.test(value)) return false;

  const [ano, mes, dia] = value.split("-").map(Number);
  const reconstruida = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    reconstruida.getUTCFullYear() === ano &&
    reconstruida.getUTCMonth() === mes - 1 &&
    reconstruida.getUTCDate() === dia
  );
}

/** Minutos desde medianoche de una hora de pared. Ordena franjas sin fechas. */
export function minutosDelDia(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Espera del modo intervalo, en milisegundos. `null` en los otros dos modos.
 *
 * Vive en el contrato y no en el editor porque los tres la necesitan: el editor
 * para comprobar el tope, el resumen para explicarla y el motor —cuando exista
 * la cola— para programar la reanudación. Una sola aritmética, un solo sitio
 * donde equivocarse. Mismo papel que `waitResponseTimeoutMs` en Esperar
 * respuesta.
 */
export function intervalWaitMs(config: IntervalConfig): number | null {
  if (config.trigger !== "interval") return null;

  return config.wait.amount * MS_POR_UNIDAD[config.wait.unit];
}

/**
 * Estrecha el momento guardado, conservando lo que haya de él.
 *
 * Devuelve `null` solo cuando no hay NADA —ni día ni hora—, que es «sin fecha
 * elegida». Con una de las dos mitades escrita devuelve el par con la otra
 * vacía: es un estado intermedio legítimo mientras se rellena, y la validación
 * es quien decide que así no se guarda.
 */
function leerMomento(momento: Record<string, unknown> | null): IntervalMoment | null {
  if (momento === null) return null;

  const date = typeof momento.date === "string" ? momento.date : "";
  const time = typeof momento.time === "string" ? momento.time : "";

  return date.length === 0 && time.length === 0 ? null : { date, time };
}

/**
 * `true` si el momento está completo y las dos mitades son legibles.
 *
 * Es un GUARDA DE TIPO, no un booleano suelto: quien pregunte por esto va a
 * leer `date` y `time` justo después, y así el compilador le deja hacerlo sin
 * repetir la comprobación ni forzar un `!` que apagaría el aviso el día que
 * `moment` pueda ser nulo por otro camino.
 */
export function esMomentoCompleto(moment: IntervalMoment | null): moment is IntervalMoment {
  return moment !== null && esFechaValida(moment.date) && esHoraValida(moment.time);
}

/**
 * Estrecha una franja suelta, o la descarta si no es representable.
 *
 * CONSERVA UNA FRANJA A MEDIO ESCRIBIR, por la misma razón exacta que
 * `leerMomento` conserva media fecha —y este lector tardó más en aprenderlo—.
 * Exigía aquí las DOS horas completas, así que en cuanto alguien borraba un
 * campo para reescribirlo la franja entera desaparecía de la configuración y la
 * fila se esfumaba bajo el cursor: era imposible corregir una hora ya puesta.
 *
 * La regla del módulo es la misma de siempre: este lector responde «¿qué se
 * puede pintar?» y una franja a medias se pinta —hay que ver lo que ya se
 * escribió para terminarlo—. Si eso puede GUARDARSE lo responde
 * `validateInterval`, que sí exige las dos horas y rechaza el nodo mientras
 * falte una.
 */
function toRange(raw: unknown): ScheduleRange | null {
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;
  const start = mitadDeFranja(record.start);
  const end = mitadDeFranja(record.end);

  // VACÍO Y CORRUPTO NO SON LO MISMO, y esa es toda la distinción. Una mitad
  // vacía es alguien a media escritura y se conserva; una mitad ilegible
  // —«25:00», un número, un objeto— es un dato que ninguna interfaz de esta
  // versión pudo producir, y esa franja no se pinta: se descarta entera.
  if (start === null || end === null) return null;

  // Sin NADA escrito tampoco hay franja que pintar.
  return start.length === 0 && end.length === 0 ? null : { start, end };
}

/**
 * Una hora de una franja: la hora escrita, `""` si falta, o `null` si es
 * ilegible. Los tres casos son distintos y el de en medio es el que se conserva.
 */
function mitadDeFranja(valor: unknown): string | null {
  if (esHoraValida(valor)) return valor;
  if (valor === undefined || valor === "") return "";

  return null;
}

/** Estrecha un día suelto. Un día ilegible se lee como apagado y sin franjas. */
function toDay(raw: unknown): ScheduleDay {
  if (typeof raw !== "object" || raw === null) return { enabled: false, ranges: [] };

  const record = raw as Record<string, unknown>;
  const ranges = Array.isArray(record.ranges)
    ? record.ranges.map(toRange).filter((r): r is ScheduleRange => r !== null)
    : [];

  return { enabled: record.enabled === true, ranges };
}

/**
 * Lee la configuración de un nodo `delay` sin confiar en ella.
 *
 * DEFENSIVO A PROPÓSITO, igual que `readWaitResponseConfig` y
 * `readMessageItems`: lo que llega es JSON de disco o de red que pudo
 * escribirse con una versión anterior. Un campo corrupto no puede tumbar ni el
 * editor ni el motor; cae al valor por defecto, y lo que quede mal configurado
 * lo dice la validación, que es quien tiene voz para eso.
 *
 * NO INVENTA UNA FECHA. Sin `moment` se lee `null` —«sin fecha elegida»—, nunca
 * el día de hoy: una fecha que el usuario no escribió es una cita que nadie
 * puso.
 *
 * PERO SÍ CONSERVA UNA FECHA A MEDIO ESCRIBIR, y esto es lo que separa a este
 * lector de la validación. Un momento se rellena en DOS gestos —primero el día,
 * luego la hora— y entre los dos la configuración está necesariamente
 * incompleta. Descartarla por incompleta hacía que escribir el día lo borrara
 * antes de poder escribir la hora: el par era imposible de completar. Lo que
 * este lector responde es «¿qué se puede pintar?», y media fecha se pinta —hay
 * que poder ver lo que ya se escribió para terminarlo—. Si eso puede guardarse
 * lo responde `validateInterval`, que sí exige las dos mitades.
 */
export function readIntervalConfig(
  config: Readonly<Record<string, unknown>>
): IntervalConfig {
  const waitBruto = config.wait;
  const wait =
    typeof waitBruto === "object" && waitBruto !== null
      ? (waitBruto as Record<string, unknown>)
      : {};

  const momentoBruto = config.moment;
  const momento =
    typeof momentoBruto === "object" && momentoBruto !== null
      ? (momentoBruto as Record<string, unknown>)
      : null;

  const scheduleBruto = config.schedule;
  const schedule =
    typeof scheduleBruto === "object" && scheduleBruto !== null
      ? (scheduleBruto as Record<string, unknown>)
      : {};

  // EL MOMENTO PRINCIPAL, entendiendo también lo que guardó la versión anterior.
  //
  // Aquella tenía `mode` con tres valores. La traducción es directa y no pierde
  // nada: `interval` y `date` eran momentos principales y siguen siéndolo;
  // `schedule` NO lo era —fue el error del modelo—, así que un nodo guardado
  // así conserva su horario, lo deja ACTIVO, y su momento principal cae al que
  // el nodo ya tuviera configurado. Nadie tiene que migrar nada a mano.
  const heredado = esModoHeredado(config.mode) ? config.mode : null;
  const trigger = esTriggerDeIntervalo(config.trigger)
    ? config.trigger
    : heredado === "date"
      ? "date"
      : heredado === "interval"
        ? "interval"
        : INTERVAL_DEFAULT_CONFIG.trigger;

  return {
    trigger,
    // Un nodo de la versión anterior en modo `schedule` tenía el horario
    // gobernando: al traducirlo, ese horario pasa a ser la restricción activa.
    scheduleEnabled:
      typeof config.scheduleEnabled === "boolean"
        ? config.scheduleEnabled
        : heredado === "schedule",
    wait: {
      amount: esCantidadDeIntervalo(wait.amount)
        ? wait.amount
        : INTERVAL_DEFAULT_CONFIG.wait.amount,
      unit: esUnidadDeIntervalo(wait.unit) ? wait.unit : INTERVAL_DEFAULT_CONFIG.wait.unit
    },
    moment: leerMomento(momento),
    schedule: semanaDe((dia) => toDay(schedule[dia]))
  };
}
