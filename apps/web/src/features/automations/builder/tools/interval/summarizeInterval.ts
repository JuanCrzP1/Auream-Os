import {
  WEEKDAYS,
  esMomentoCompleto,
  readIntervalConfig,
  type IntervalConfig,
  type IntervalSchedule,
  type IntervalUnit
} from "@contracts/IntervalConfig";
import { formatearEnDoce } from "./time12";
import {
  NOMBRES_DE_DIA,
  diasActivos,
  diasConsecutivos,
  franjasOrdenadas,
  franjasUniformes
} from "./intervalSchedule";

// ---------------------------------------------------------------------------
// Cómo se lee un Intervalo, en palabras.
//
// PURO y DERIVADO: recibe configuración y devuelve texto. Nunca es fuente de
// verdad, no toca React ni el DOM, y por eso lo pueden reutilizar el nodo
// cerrado del lienzo, el editor y la paleta sin que ninguno escriba su propia
// versión de la misma frase.
//
// DOS LONGITUDES, UNA SOLA VERDAD. `describirIntervalo` es la frase corta que
// cabe bajo el título del nodo; `explicarIntervalo` es la frase larga que el
// editor enseña cuando la configuración ya es válida. Las dos salen de la misma
// lectura, así que no pueden contarse cosas distintas.
//
// LAS HORAS SE DICEN EN DOCE, igual que en el editor. El disco guarda
// veinticuatro —el contrato no se movió— pero en ningún sitio donde haya una
// persona leyendo aparece «14:45»: ni en el campo, ni en el nodo del lienzo, ni
// en la confirmación. Un producto que enseña la misma hora de dos maneras
// obliga a su usuario a traducir, y esa traducción no es trabajo suyo.
//
// LAS DOS SE COMPONEN IGUAL: primero el MOMENTO PRINCIPAL —una espera o una
// cita, nunca las dos— y después, solo si está encendido, el HORARIO. Esa suma
// no es un adorno de redacción: es la única forma de que el texto diga lo que
// el modelo permite, que es tener las dos cosas a la vez. Un horario apagado no
// se menciona aunque tenga días guardados, porque no gobierna nada.
// ---------------------------------------------------------------------------

/** Singular y plural de cada unidad. Sin «1 minutos». */
const UNIDADES: Readonly<Record<IntervalUnit, readonly [string, string]>> = {
  seconds: ["segundo", "segundos"],
  minutes: ["minuto", "minutos"],
  hours: ["hora", "horas"],
  days: ["día", "días"]
};

/**
 * La hora como se lee, o tal cual si todavía no es una hora.
 *
 * Nunca se traga lo que no entiende: un valor a medio configurar se enseña sin
 * disfrazar, que es lo que permite reconocerlo y corregirlo.
 */
const enDoce = (hhmm: string): string => formatearEnDoce(hhmm) ?? hhmm;

/** «3 minutos», «1 hora». */
export function describirEspera(amount: number, unit: IntervalUnit): string {
  const [singular, plural] = UNIDADES[unit];

  return `${amount} ${amount === 1 ? singular : plural}`;
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
] as const;

/**
 * «25 sep 2026» a partir de `YYYY-MM-DD`.
 *
 * Se compone leyendo la cadena, NO con `new Date(...).toLocaleDateString()`:
 * construir un `Date` a partir de una fecha de pared la interpreta en la zona
 * del navegador y puede devolver el día anterior. Aquí no hay ningún instante
 * que calcular —solo un día que escribir— así que no se involucra ninguna zona.
 */
function describirFecha(date: string): string {
  const [ano, mes, dia] = date.split("-");

  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${ano}`;
}

/** Las franjas de un día: «09:00 a.m.–12:00 p.m. y 02:00 p.m.–06:00 p.m.». */
function describirFranjas(schedule: IntervalSchedule, dia: (typeof WEEKDAYS)[number]): string {
  const franjas = franjasOrdenadas(schedule[dia].ranges).map(
    (franja) => `${enDoce(franja.start)}–${enDoce(franja.end)}`
  );

  if (franjas.length <= 1) return franjas.join("");

  return `${franjas.slice(0, -1).join(", ")} y ${franjas[franjas.length - 1]}`;
}

/**
 * Los días activos, agrupados cuando se puede.
 *
 * «Lun–Vie» si son consecutivos, la lista si no. Enumerar cinco días idénticos
 * llena la línea sin decir nada que el rango no diga mejor.
 */
function describirDias(schedule: IntervalSchedule, corto: boolean): string {
  const activos = diasActivos(schedule);
  const nombre = (dia: (typeof WEEKDAYS)[number]) =>
    corto ? NOMBRES_DE_DIA[dia].slice(0, 3) : NOMBRES_DE_DIA[dia].toLowerCase();

  if (activos.length === 0) return "";
  if (activos.length === 1) return nombre(activos[0]);

  if (diasConsecutivos(schedule)) {
    const union = corto ? "–" : " a ";
    return `${nombre(activos[0])}${union}${nombre(activos[activos.length - 1])}`;
  }

  const nombres = activos.map(nombre);
  return corto
    ? nombres.join(", ")
    : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * Frase CORTA, para el nodo cerrado del lienzo.
 *
 * Deliberadamente breve: la tarjeta cerrada responde a «qué hace este nodo» de
 * un vistazo, no reproduce el editor. Con un horario irregular dice los días y
 * remite al editor en vez de desplegar cinco tramos distintos en una línea que
 * no cabe.
 */
export function describirIntervalo(config: IntervalConfig): string {
  const momento = describirMomento(config);

  // El horario se AÑADE al momento, no lo sustituye. Sin abreviar los días
  // aquí: en una línea que ya lleva una fecha completa, «lun–vie 09:00–18:00»
  // no cabe y además compite con el dato principal. El editor los enseña.
  return config.scheduleEnabled ? `${momento} + horario permitido` : momento;
}

/**
 * El momento principal, corto. Uno de los dos, nunca los dos.
 *
 * Se exporta porque el nodo cerrado lo necesita SUELTO: allí la clase de espera
 * y la restricción horaria ya viajan en su propia línea de versalitas, así que
 * repetir «+ horario permitido» en el valor lo diría dos veces y dejaría sin
 * sitio al dato que se viene a leer.
 */
export function describirMomento(config: IntervalConfig): string {
  if (config.trigger === "interval") {
    return `Esperar ${describirEspera(config.wait.amount, config.wait.unit)}`;
  }

  // Media fecha todavía no dice nada: el lector la conserva para poder
  // terminarla, pero resumirla sería anunciar una cita a medias.
  if (!esMomentoCompleto(config.moment)) return "Sin fecha configurada";

  return `${describirFecha(config.moment.date)} · ${enDoce(config.moment.time)}`;
}

/**
 * Frase LARGA, para la confirmación del editor.
 *
 * Aquí sí hay sitio para una oración entera, y su trabajo es que el usuario
 * reconozca lo que acaba de configurar antes de guardar. Devuelve `null` cuando
 * la configuración todavía no dice nada —sin fecha, sin días—: una confirmación
 * de algo incompleto sería una confirmación falsa.
 */
export function explicarIntervalo(config: IntervalConfig): string | null {
  const momento = explicarMomento(config);
  if (momento === null) return null;

  if (!config.scheduleEnabled) return cerrar(momento);

  const horario = explicarHorario(config);
  if (horario === null) return null;

  return cerrar(`${momento}, ${horario}`);
}

/**
 * Pone el punto final, salvo si la frase ya termina en uno.
 *
 * Hace falta porque las horas se dicen «06:00 p.m.», con punto al final: una
 * oración que acabe en una hora ya viene cerrada, y añadirle otro dejaba «p.m..»
 * a la vista. Un detalle de una línea que en pantalla se ve enseguida.
 */
const cerrar = (frase: string): string => (frase.endsWith(".") ? frase : `${frase}.`);

/** El momento principal, en una oración y sin punto final. */
function explicarMomento(config: IntervalConfig): string | null {
  if (config.trigger === "interval") {
    return `La conversación continuará ${describirEspera(
      config.wait.amount,
      config.wait.unit
    )} después de llegar a este bloque`;
  }

  if (!esMomentoCompleto(config.moment)) return null;

  return `La conversación quedará en espera hasta el ${describirFecha(
    config.moment.date
  )} a las ${enDoce(config.moment.time)}`;
}

/**
 * La restricción horaria, como continuación de la oración anterior.
 *
 * `null` cuando no hay ningún día encendido: un horario activo y vacío no
 * describe ninguna ventana, y afirmar que se respetará sería mentir.
 */
function explicarHorario(config: IntervalConfig): string | null {
  const activos = diasActivos(config.schedule);
  if (activos.length === 0) return null;

  const dias = describirDias(config.schedule, false);

  if (!franjasUniformes(config.schedule)) {
    return `y solo dentro del horario configurado de ${dias}`;
  }

  return `y solo de ${dias}, entre ${describirFranjas(config.schedule, activos[0])}`;
}

/**
 * Resumen de un «Intervalo» para la tarjeta del lienzo, cerrada.
 *
 * Es el que ve quien NO tiene cuerpo compacto delante —la paleta, el
 * inspector—, y por eso reutiliza la frase corta en vez de escribir otra.
 */
export function summarizeInterval(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): string {
  return describirIntervalo(readIntervalConfig(config));
}
