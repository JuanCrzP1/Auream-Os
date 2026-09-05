import type { MessageItem } from "./types";
import { readMessageItems } from "./readMessageConfig";
import { esEnlaceUsable } from "./mediaSource";

// ---------------------------------------------------------------------------
// ¿Hay algo que enviar?
//
// Responde a UNA pregunta y solo a esa: si esta configuración de Mensaje
// contiene al menos un contenido que el cliente vaya a recibir de verdad.
//
// PURO. No conoce React, ni el editor, ni el botón de guardar, ni el lienzo,
// ni la base de datos. Recibe `content` y `config` —lo mismo que ya reciben
// `summarizeMessage` y el lector— y devuelve una decisión. Quien la presente y
// quien la haga cumplir son otros.
//
// POR QUÉ NO REUTILIZA `isExecutableKind`: aquella responde a «¿sabe el motor
// emitir esto HOY?» y solo acepta texto, porque los medios todavía no viajan.
// Esta responde a «¿configuró el usuario algo que su cliente recibirá?», que es
// una pregunta de producto y acepta los cinco tipos de contenido. Son dos
// conceptos distintos que casualmente hoy se parecen, y fundirlos haría que
// arreglar el envío de medios rompiera la validación.
//
// LISTO PARA LA FASE C: cuando exista almacenamiento real, un medio subido
// tendrá su enlace en `config` igual que hoy lo tiene uno pegado a mano, así
// que `tieneFuente` seguirá siendo cierto sin tocar nada. Si además apareciera
// otra forma de fuente —un `assetId`, por ejemplo—, se añade aquí y en ningún
// otro sitio.
// ---------------------------------------------------------------------------

/** Lo que se le dice al usuario cuando no hay nada que enviar. */
export const SIN_CONTENIDO = "Agrega al menos un contenido para enviar antes de guardar.";

/** Lo que se le dice cuando sí puso contenido, pero le falta la fuente. */
export const CONTENIDO_SIN_FUENTE =
  "Completa el archivo o el enlace de tu contenido antes de guardar.";

/** Rótulo del preview cuando no hay nada que el cliente vaya a recibir. */
export const PREVIEW_SIN_CONTENIDO = "Sin contenido para enviar";

/**
 * Bloques que el cliente recibe.
 *
 * Una pausa no está entre ellos: es tiempo ENTRE dos envíos, no un envío. Es la
 * misma frontera que aplica el preview compacto, y por eso se declara una sola
 * vez, aquí.
 */
export function esBloqueDeContenido(item: MessageItem): boolean {
  return item.kind !== "interval";
}

/**
 * `true` si el bloque tiene de dónde sacar lo que envía.
 *
 * UN TEXTO SE SOSTIENE POR SÍ MISMO. Poner un bloque de texto ya es declarar
 * que ahí va un mensaje, aunque todavía esté en blanco; la regla acordada
 * enumera «Texto → VÁLIDO» sin más condiciones y no se le añaden aquí.
 * (Consecuencia conocida: un Mensaje cuyo único bloque sea un texto vacío se
 * puede guardar y enviaría una cadena vacía. Estrecharlo es cambiar la línea
 * correspondiente por `item.text.trim().length > 0`.)
 *
 * UN MEDIO NECESITA UNA FUENTE, Y CON UNA BASTA: archivo O enlace. Es un OR, no
 * una lista de requisitos — a quien ya eligió una foto de su disco no se le
 * puede pedir además un enlace.
 *
 * Que el archivo todavía no sobreviva a recargar es un asunto de PERSISTENCIA,
 * no de validez: el usuario configuró su medio y el borrador es correcto. Las
 * dos preguntas se responden en sitios distintos y confundirlas fue el defecto
 * que esta función tenía.
 */
function tieneFuente(item: MessageItem): boolean {
  if (item.kind === "interval") return false;
  if (item.kind === "text") return true;

  return esEnlaceUsable(item.url) || (item.fileName ?? "").trim().length > 0;
}

/** Resultado de examinar la configuración. `motivo` es null si todo está bien. */
export interface ValidezDelMensaje {
  readonly valido: boolean;
  readonly motivo: string | null;
}

/**
 * Examina una configuración de Mensaje.
 *
 * Distingue los dos fallos posibles porque al usuario le sirven cosas
 * distintas: no es lo mismo «no has puesto nada» que «pusiste una imagen y te
 * falta el enlace». Con un único mensaje genérico, el segundo caso deja al
 * usuario mirando un bloque que él sí ve configurado.
 */
export function validateMessageContent(
  content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): ValidezDelMensaje {
  const bloques = readMessageItems(config, content).filter(esBloqueDeContenido);

  if (bloques.some(tieneFuente)) return { valido: true, motivo: null };

  return {
    valido: false,
    motivo: bloques.length === 0 ? SIN_CONTENIDO : CONTENIDO_SIN_FUENTE
  };
}
