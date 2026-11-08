import type { IntervalUnit } from "@contracts/IntervalConfig";

/**
 * Configuración de Mensaje: una SECUENCIA de bloques en `config.items`, que es
 * la única fuente de verdad. `content.text` solo se lee por compatibilidad con
 * nodos anteriores, y el editor lo retira en la primera escritura.
 */

export type MessageItemKind = "text" | "image" | "video" | "audio" | "file" | "interval";

export type MessageMediaKind = "image" | "video" | "audio" | "file";

/**
 * Unidades de una pausa entre bloques. Mismo vocabulario de duración que el
 * Programador (`IntervalUnit`), sin días: una pausa dentro de un mensaje no
 * dura días.
 */
export type MessageIntervalUnit = Exclude<IntervalUnit, "days">;

interface MessageItemBase {
  /** Identidad estable: sin ella, reordenar re-monta los campos y pierde el foco. */
  readonly id: string;
}

/** Texto. Único bloque que el motor envía hoy. */
export interface MessageTextItem extends MessageItemBase {
  readonly kind: "text";
  readonly text: string;
}

/**
 * Imagen, video, audio o archivo. Dos fuentes, basta una: `url` (un dato que
 * sobrevive a todo) o `fileName` (un archivo del dispositivo cuyos bytes viven
 * en `mediaSourceSession` y no sobreviven a recargar). En Fase C, subir el
 * archivo rellenará `url`.
 */
export interface MessageMediaItem extends MessageItemBase {
  readonly kind: MessageMediaKind;
  readonly url: string;
  readonly fileName?: string;
  readonly caption: string;
  /** Enviar una sola vez por conversación. Modelado; lo ejecutará el motor. */
  readonly sendOnce: boolean;
}

/** Pausa entre dos bloques. No es el Programador, que suspende la sesión entera. */
export interface MessageIntervalItem extends MessageItemBase {
  readonly kind: "interval";
  readonly amount: number;
  readonly unit: MessageIntervalUnit;
}

export type MessageItem = MessageTextItem | MessageMediaItem | MessageIntervalItem;

export interface MessageConfig {
  readonly items: ReadonlyArray<MessageItem>;
}
