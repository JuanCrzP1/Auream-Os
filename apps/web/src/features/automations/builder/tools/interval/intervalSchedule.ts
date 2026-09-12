import {
  SCHEDULE_DEFAULT_RANGE,
  WEEKDAYS,
  minutosDelDia,
  type IntervalSchedule,
  type ScheduleRange,
  type Weekday
} from "@contracts/IntervalConfig";

// ---------------------------------------------------------------------------
// Operaciones sobre el horario de un Intervalo.
//
// POR QUÉ NO ESTÁN EN EL CONTRATO. Allí vive lo que las DOS orillas necesitan:
// la forma, la lectura defensiva y la aritmética de la espera. Esto es otra
// cosa —encender un día, añadir una franja, moverle la hora—: son los gestos
// del editor, y el motor nunca los ejecuta. La frontera es la misma que separa
// `readDistributorConfig` de su `contracts/`: lo que no cruza, no sube.
//
// PURO: sin React, sin DOM, sin CSS. Recibe un horario y devuelve otro; nunca
// muta el que le dan. Todo lo que aquí se decide se puede probar sin montar una
// pantalla.
// ---------------------------------------------------------------------------

/** Rótulos de los días, en español y en el orden en que se leen. */
export const NOMBRES_DE_DIA: Readonly<Record<Weekday, string>> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo"
};

/** Sustituye un día dejando los otros seis intactos. */
function conDia(
  schedule: IntervalSchedule,
  day: Weekday,
  ranges: ReadonlyArray<ScheduleRange>,
  enabled: boolean
): IntervalSchedule {
  return { ...schedule, [day]: { enabled, ranges } };
}

/**
 * Enciende o apaga un día.
 *
 * AL ENCENDER, UN DÍA SIN FRANJAS RECIBE UNA. Un día activo y vacío no
 * significa nada —no hay ninguna hora en la que pueda continuar— y obligaría al
 * usuario a un segundo gesto para que su primer gesto sirviera de algo. La
 * franja propuesta es la del contrato y está ahí para editarse, no para
 * quedarse.
 *
 * AL APAGAR, LAS FRANJAS SE CONSERVAN. Apagar un día es decir «hoy no», no
 * «bórrame lo que había configurado»: volver a encenderlo devuelve sus horas.
 */
export function alternarDia(
  schedule: IntervalSchedule,
  day: Weekday,
  enabled: boolean
): IntervalSchedule {
  const actual = schedule[day];
  const ranges =
    enabled && actual.ranges.length === 0 ? [SCHEDULE_DEFAULT_RANGE] : actual.ranges;

  return conDia(schedule, day, ranges, enabled);
}

/** Añade una franja al final del día. */
export function anadirFranja(schedule: IntervalSchedule, day: Weekday): IntervalSchedule {
  const actual = schedule[day];

  return conDia(schedule, day, [...actual.ranges, SCHEDULE_DEFAULT_RANGE], actual.enabled);
}

/**
 * Quita la franja de esa posición.
 *
 * QUITAR LA ÚLTIMA APAGA EL DÍA. Un día encendido sin ninguna franja es la
 * contradicción que la validación rechaza, y dejar al usuario dentro de ella
 * para que la resuelva a mano sería hacerle arreglar algo que su gesto ya
 * dijo: quitar la única hora de un día es no querer ese día.
 */
export function quitarFranja(
  schedule: IntervalSchedule,
  day: Weekday,
  index: number
): IntervalSchedule {
  const actual = schedule[day];
  const ranges = actual.ranges.filter((_, i) => i !== index);

  return conDia(schedule, day, ranges, ranges.length === 0 ? false : actual.enabled);
}

/** Cambia una de las dos horas de una franja. */
export function editarFranja(
  schedule: IntervalSchedule,
  day: Weekday,
  index: number,
  extremo: "start" | "end",
  hora: string
): IntervalSchedule {
  const actual = schedule[day];
  const ranges = actual.ranges.map((franja, i) =>
    i === index ? { ...franja, [extremo]: hora } : franja
  );

  return conDia(schedule, day, ranges, actual.enabled);
}

/** Los días encendidos, en orden de semana. */
export function diasActivos(schedule: IntervalSchedule): Weekday[] {
  return WEEKDAYS.filter((dia) => schedule[dia].enabled);
}

/**
 * `true` si todos los días encendidos tienen exactamente las mismas franjas.
 *
 * Lo usa el resumen para poder decir «de lunes a viernes, 09:00–18:00» en vez
 * de enumerar cinco días idénticos. Compara por valor —hora a hora y en
 * orden—, no por identidad de objeto.
 */
export function franjasUniformes(schedule: IntervalSchedule): boolean {
  const activos = diasActivos(schedule);
  if (activos.length < 2) return true;

  const firma = (dia: Weekday) =>
    schedule[dia].ranges.map((r) => `${r.start}-${r.end}`).join("|");
  const primera = firma(activos[0]);

  return activos.every((dia) => firma(dia) === primera);
}

/**
 * `true` si los días encendidos son consecutivos en la semana.
 *
 * Permite decir «de lunes a viernes» en lugar de «lunes, martes, miércoles,
 * jueves y viernes». Con lunes, miércoles y viernes devuelve `false` y el
 * resumen los enumera, que es lo correcto: ahí no hay un rango que contar.
 */
export function diasConsecutivos(schedule: IntervalSchedule): boolean {
  const indices = diasActivos(schedule).map((dia) => WEEKDAYS.indexOf(dia));
  if (indices.length < 2) return true;

  return indices.every((valor, i) => i === 0 || valor === indices[i - 1] + 1);
}

/**
 * Franjas de un día ordenadas por hora de inicio.
 *
 * El usuario puede añadirlas en cualquier orden y no se le reordena por debajo
 * mientras escribe —eso movería la fila que está editando—, así que quien
 * necesita leerlas en orden (el resumen, y quien busque solapes) las pide aquí.
 */
export function franjasOrdenadas(
  ranges: ReadonlyArray<ScheduleRange>
): ScheduleRange[] {
  return [...ranges].sort((a, b) => minutosDelDia(a.start) - minutosDelDia(b.start));
}
