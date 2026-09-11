// ---------------------------------------------------------------------------
// ¿Puede guardarse este Distribuidor?
//
// PURO. No conoce React, ni el editor, ni el botón de guardar, ni el lienzo.
// Misma firma que `validateWaitResponse` y `validateMessageContent` —la que
// declara `ToolDefinition`—, y quien la presenta es el marco del nodo
// expandido, que la consulta sin saber de qué herramienta se trata.
//
// MIRA EL CRUDO, no lo que devuelve `readDistributorOutputs`. El lector es
// defensivo y sanea lo que encuentra —tira una salida sin id, se queda con la
// primera de dos que repitan—, así que validar sobre lo saneado daría por bueno
// justo lo que hay que señalar. El lector dice qué se puede pintar; esto dice
// qué se puede guardar.
//
// LO QUE NO SE VALIDA, Y POR QUÉ:
//
//   · Un Distribuidor SIN salidas. Es el estado con el que nace y un estado
//     intermedio legítimo: quien acaba de arrastrar la herramienta al lienzo
//     todavía no ha configurado nada y tiene derecho a guardar y volver luego.
//     Que un nodo sin salidas no lleve la conversación a ninguna parte es una
//     pregunta sobre el GRAFO —«¿puede publicarse este flujo?»— y se responde
//     donde se responden las del grafo, no aquí.
//   · La política de reparto. No existe: no hay nada que validar de ella.
// ---------------------------------------------------------------------------

import { normalizarIdDeSalida } from "./distributorOutputs";

/** Dos salidas con la misma identidad: sus puntos de conexión serían el mismo. */
export const SALIDAS_DUPLICADAS =
  "Hay dos salidas con la misma identidad. Elimina una de las dos para poder guardar.";

/** Una salida sin nada legible dentro. */
export const SALIDA_ILEGIBLE =
  "Una de las salidas está incompleta. Elimínala y vuelve a añadirla.";

export interface ValidezDelDistribuidor {
  readonly valido: boolean;
  readonly motivo: string | null;
}

export function validateDistributor(
  _content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): ValidezDelDistribuidor {
  const raw = config.outputs;

  // Ausente o no-lista se lee como «sin salidas», que es válido: es justo lo que
  // hace el lector. No hay contradicción que señalar.
  if (!Array.isArray(raw)) return { valido: true, motivo: null };

  const vistos = new Set<string>();

  for (const salida of raw) {
    if (typeof salida !== "object" || salida === null) {
      return { valido: false, motivo: SALIDA_ILEGIBLE };
    }

    // MISMA REGLA QUE EL LECTOR, leída del dominio en vez de reescrita: si
    // mañana una identidad exige algo más, las dos orillas se enteran a la vez.
    const id = normalizarIdDeSalida((salida as Record<string, unknown>).id);
    if (id === null) {
      return { valido: false, motivo: SALIDA_ILEGIBLE };
    }

    // El lector responde a un id repetido quedándose con el primero, para poder
    // pintar algo coherente; aquí se rechaza. Misma condición, dos respuestas
    // distintas — y cada una pertenece a quien la da.
    if (vistos.has(id)) {
      return { valido: false, motivo: SALIDAS_DUPLICADAS };
    }
    vistos.add(id);
  }

  return { valido: true, motivo: null };
}
