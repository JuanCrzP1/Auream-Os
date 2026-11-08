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
 * Imagen, video, audio o archivo. Dos fuentes:
 *   · un enlace escrito (`url`), o
 *   · un archivo del dispositivo, que se SUBE al almacén de la cuenta: queda
 *     su URL pública en `url`, su nombre en `fileName` y el registro en
 *     `mediaId`. Sobrevive a recargar, a duplicar y a cambiar de equipo.
 * Un `fileName` sin `url` es un archivo de antes de la subida (o una subida
 * que no terminó): no tiene bytes guardados y hay que volver a elegirlo.
 */
export interface MessageMediaItem extends MessageItemBase {
  readonly kind: MessageMediaKind;
  readonly url: string;
  readonly fileName?: string;
  /** Registro del archivo subido (`media_assets.id`). */
  readonly mediaId?: string;
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
