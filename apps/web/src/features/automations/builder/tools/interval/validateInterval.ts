import {
  INTERVAL_MAX_WAIT_MS,
  WEEKDAYS,
  esCantidadDeIntervalo,
  esFechaValida,
  esHoraValida,
  esTriggerDeIntervalo,
  esUnidadDeIntervalo,
  intervalWaitMs,
  minutosDelDia,
  readIntervalConfig
} from "@contracts/IntervalConfig";

// ---------------------------------------------------------------------------
// ¿Puede guardarse este Intervalo?
//
// PURO. No conoce React, ni el editor, ni el botón de guardar, ni el lienzo.
// Misma firma que `validateWaitResponse` y `validateDistributor` —la que
// declara `ToolDefinition`—, y quien la presenta es el marco del nodo
// expandido, que la consulta sin saber de qué herramienta se trata.
//
// UNA SOLA FUENTE DE REGLAS. Ni el editor ni los componentes de modo repiten
// ninguna de estas comprobaciones: preguntan aquí. Es lo que evita que el botón
// de guardar y el aviso que el usuario lee puedan discrepar.
//
// DOS COSAS DISTINTAS SE VALIDAN DISTINTO, y esa es la regla de negocio:
//
//   · EL MOMENTO PRINCIPAL (`trigger`) siempre tiene que estar completo. Es lo
//     que decide cuándo continúa la conversación, y sin él el nodo no hace
//     nada. Se valida el que gobierna y solo ese: una fecha a medias no puede
//     impedir guardar un nodo que hoy espera tres minutos.
//
//   · EL HORARIO es una RESTRICCIÓN OPCIONAL y solo se valida SI ESTÁ ACTIVO.
//     Apagado, puede contener lo que sea —restos de una configuración anterior
//     incluida— sin bloquear nada, porque no gobierna. Encendido, tiene que
//     tener al menos un día y franjas legibles: un horario activo y vacío no
//     dejaría continuar la conversación nunca.
//
// LAS COMBINACIONES IMPOSIBLES NO SE VALIDAN AQUÍ porque no se pueden
// representar: «después + fecha» no existe —`trigger` es uno solo— y «horario
// a secas» tampoco —siempre hay `trigger`—. Lo que el modelo hace imposible no
// necesita una regla que lo rechace.
// ---------------------------------------------------------------------------

export const MODO_DESCONOCIDO = "Elige cuándo debe continuar la conversación.";

export const CANTIDAD_INVALIDA = "La espera debe ser un número entero mayor que cero.";

export const UNIDAD_INVALIDA = "Elige segundos, minutos, horas o días.";

export const ESPERA_DEMASIADO_LARGA =
  "La espera no puede superar los 31 días. Para pausas más largas, usa una fecha.";

export const FECHA_INCOMPLETA = "Elige la fecha y la hora en las que continuar.";

export const FECHA_INVALIDA = "Esa fecha no existe. Revisa el día y el mes.";

// Dice QUÉ HACER, no qué está mal, y trae el ejemplo: el campo de hora acepta
// varias formas de escribirla y quien se equivocó necesita una que funcione
// seguro, no el rango de horas que ya se imaginaba.
export const HORA_INVALIDA = "Escribe una hora válida, por ejemplo 14:45.";

export const SIN_DIAS_ACTIVOS =
  "Activa al menos un día para que la conversación pueda continuar.";

export const DIA_SIN_FRANJAS = "Un día activo necesita al menos un horario.";

export const FRANJA_INVERTIDA = "La hora de fin debe ser posterior a la de inicio.";

export interface ValidezDelIntervalo {
  readonly valido: boolean;
  readonly motivo: string | null;
}

const VALIDO: ValidezDelIntervalo = { valido: true, motivo: null };

const invalido = (motivo: string): ValidezDelIntervalo => ({ valido: false, motivo });

/**
 * Examina la configuración de un «Intervalo».
 *
 * Lee `config` EN CRUDO para lo que el lector sanearía —la cantidad, la unidad,
 * la fecha— y a través del lector para lo estructural. El lector dice qué se
 * puede pintar; esto dice qué se puede guardar, y validar sobre lo ya saneado
 * daría por bueno justo lo que hay que señalar.
 */
export function validateInterval(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): ValidezDelIntervalo {
  // Un `trigger` ausente se lee como el del contrato —así nace un nodo nuevo, y
  // así se traduce uno de la versión anterior— y no es un error. Uno presente
  // pero desconocido sí: viene de una versión que esta no sabe interpretar, y
  // guardarlo encima lo perdería.
  if (config.trigger !== undefined && !esTriggerDeIntervalo(config.trigger)) {
    return invalido(MODO_DESCONOCIDO);
  }

  const leida = readIntervalConfig(config);

  // 1 · El momento principal, siempre.
  const momento = leida.trigger === "interval" ? validarEspera(config) : validarFecha(config);
  if (!momento.valido) return momento;

  // 2 · La restricción horaria, solo si está activa.
  return leida.scheduleEnabled ? validarHorario(config) : VALIDO;
}

/** Momento principal «después»: una cantidad, una unidad y un tope. */
function validarEspera(config: Readonly<Record<string, unknown>>): ValidezDelIntervalo {
  const bruto = config.wait;
  // Ausente es válido: el nodo cae al default del contrato, que es una espera
  // completa. Lo que no puede es estar presente y no servir.
  if (bruto === undefined) return VALIDO;

  if (typeof bruto !== "object" || bruto === null) return invalido(CANTIDAD_INVALIDA);

  const wait = bruto as Record<string, unknown>;
  if (!esCantidadDeIntervalo(wait.amount)) return invalido(CANTIDAD_INVALIDA);
  if (!esUnidadDeIntervalo(wait.unit)) return invalido(UNIDAD_INVALIDA);

  const ms = intervalWaitMs({ ...readIntervalConfig(config), trigger: "interval" });
  if (ms !== null && ms > INTERVAL_MAX_WAIT_MS) return invalido(ESPERA_DEMASIADO_LARGA);

  return VALIDO;
}

/** Momento principal «fecha»: día y hora, los dos, y que el día exista. */
function validarFecha(config: Readonly<Record<string, unknown>>): ValidezDelIntervalo {
  const bruto = config.moment;

  // Aquí la ausencia SÍ es un error, al contrario que en la espera: no hay
  // fecha por defecto que valga —ninguna se puede inventar por el usuario—, así
  // que un nodo cuyo momento principal es una cita, sin cita, está a medias.
  if (typeof bruto !== "object" || bruto === null) return invalido(FECHA_INCOMPLETA);

  const moment = bruto as Record<string, unknown>;
  const tieneDia = typeof moment.date === "string" && moment.date.length > 0;
  const tieneHora = typeof moment.time === "string" && moment.time.length > 0;

  if (!tieneDia || !tieneHora) return invalido(FECHA_INCOMPLETA);
  if (!esFechaValida(moment.date)) return invalido(FECHA_INVALIDA);
  if (!esHoraValida(moment.time)) return invalido(HORA_INVALIDA);

  return VALIDO;
}

/** La restricción horaria: al menos un día encendido y toda franja bien formada. */
function validarHorario(config: Readonly<Record<string, unknown>>): ValidezDelIntervalo {
  const bruto = config.schedule;
  const schedule =
    typeof bruto === "object" && bruto !== null ? (bruto as Record<string, unknown>) : {};

  let algunDiaActivo = false;

  for (const dia of WEEKDAYS) {
    const diaBruto = schedule[dia];
    if (typeof diaBruto !== "object" || diaBruto === null) continue;

    const { enabled, ranges } = diaBruto as Record<string, unknown>;
    if (enabled !== true) continue;

    algunDiaActivo = true;

    if (!Array.isArray(ranges) || ranges.length === 0) return invalido(DIA_SIN_FRANJAS);

    for (const franjaBruta of ranges) {
      if (typeof franjaBruta !== "object" || franjaBruta === null) {
        return invalido(HORA_INVALIDA);
      }

      const { start, end } = franjaBruta as Record<string, unknown>;
      if (!esHoraValida(start) || !esHoraValida(end)) return invalido(HORA_INVALIDA);

      // Sin fechas de por medio, una franja es un tramo DENTRO de un día: si el
      // fin no va después del inicio, no hay tramo. Cruzar la medianoche sería
      // otro día, y eso se configura encendiendo ese otro día.
      if (minutosDelDia(end) <= minutosDelDia(start)) return invalido(FRANJA_INVERTIDA);
    }
  }

  if (!algunDiaActivo) return invalido(SIN_DIAS_ACTIVOS);

  return VALIDO;
}
