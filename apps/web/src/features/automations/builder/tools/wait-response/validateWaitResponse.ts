import {
  esCantidadValida,
  esUnidadValida,
  resolveContextKey
} from "@contracts/WaitResponseConfig";

// ---------------------------------------------------------------------------
// ¿Puede guardarse esta espera?
//
// PURO. No conoce React, ni el editor, ni el botón de guardar, ni el lienzo.
// Recibe `content` y `config` —la misma firma que `validateMessageContent`,
// porque es la que declara `ToolDefinition`— y devuelve una decisión con su
// motivo. Quien la presente es el marco del nodo expandido, que la consulta sin
// saber de qué herramienta se trata.
//
// SEMÁNTICA, NO TEXTUAL: cada regla mira el DATO —el tipo, el rango, la
// coherencia entre dos campos—, nunca lo que se ve escrito en un control. Por
// eso estas comprobaciones siguen valiendo si mañana cambia una etiqueta.
//
// LO QUE NO SE VALIDA, Y POR QUÉ:
//
//   · El mensaje previo. Es OPCIONAL por diseño: un «Esperar respuesta» detrás
//     de un Mensaje que ya preguntó no tiene nada que decir. Exigir texto sería
//     inventar un requisito que la herramienta no tiene.
//   · La reacción. Ausente = no se reacciona; no hay forma de que sea inválida.
//   · El fallback del grafo. Que un `question` necesite una salida de rescate lo
//     comprueba `validateFallbacks` sobre el GRAFO, en el backend. Es otra
//     pregunta —«¿puede publicarse este flujo?»— y mezclarla aquí impediría
//     guardar un nodo bien configurado por algo que no depende de él.
// ---------------------------------------------------------------------------

/** Sin límite y con tiempo máximo a la vez: hay que elegir. */
export const ESPERA_CONTRADICTORIA =
  "Desactiva «Esperar sin límite» para poder fijar un tiempo máximo.";

/** Con límite pero sin decir de cuánto. */
export const TIEMPO_INCOMPLETO = "Indica cuánto tiempo se espera como máximo.";

/** Cantidad fuera de lo que una espera puede significar. */
export const TIEMPO_INVALIDO = "El tiempo máximo debe ser un número entero mayor que cero.";

/** Unidad que la herramienta no ofrece. */
export const UNIDAD_INVALIDA = "Elige minutos u horas para el tiempo máximo.";

/** Campo destino que no se puede resolver contra el contexto de la sesión. */
export const DESTINO_INVALIDO =
  "El campo donde guardar la respuesta solo admite letras, números y guion bajo.";

/**
 * Un nombre de campo utilizable dentro del contexto de la conversación.
 *
 * `EdgeEvaluator` y las plantillas `{{context.x}}` resuelven contra
 * `session.context[x]`: un nombre con puntos, espacios o corchetes se escribiría
 * bien y sería ilegible después, que es peor que no dejar escribirlo.
 */
const CAMPO_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface ValidezDeLaEspera {
  readonly valido: boolean;
  readonly motivo: string | null;
}

/**
 * Examina la configuración de un «Esperar respuesta».
 *
 * Lee `config` EN CRUDO y no a través de `readWaitResponseConfig`: el lector es
 * defensivo y sanea lo que encuentra —descarta un timeout corrupto, recorta un
 * destino— y validar sobre lo saneado daría por bueno justo lo que hay que
 * señalar. La validación mira lo que el usuario dejó escrito; el lector, lo que
 * el motor puede ejecutar.
 */
export function validateWaitResponse(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): ValidezDeLaEspera {
  const sinLimite = config.waitIndefinitely !== false;
  const timeoutBruto = config.timeout;
  const timeout =
    typeof timeoutBruto === "object" && timeoutBruto !== null
      ? (timeoutBruto as Record<string, unknown>)
      : null;

  if (sinLimite && timeout !== null) {
    return { valido: false, motivo: ESPERA_CONTRADICTORIA };
  }

  if (!sinLimite) {
    if (timeout === null) return { valido: false, motivo: TIEMPO_INCOMPLETO };
    if (!esCantidadValida(timeout.amount)) return { valido: false, motivo: TIEMPO_INVALIDO };
    if (!esUnidadValida(timeout.unit)) return { valido: false, motivo: UNIDAD_INVALIDA };
  }

  // El destino es opcional; lo que no puede es estar puesto y no servir.
  const destino = resolveContextKey(config.targetKey);
  if (destino !== null && !CAMPO_VALIDO.test(destino)) {
    return { valido: false, motivo: DESTINO_INVALIDO };
  }

  return { valido: true, motivo: null };
}
