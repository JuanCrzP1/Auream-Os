/**
 * Forma de la configuración de Mensaje.
 *
 * Un nodo Mensaje contiene una SECUENCIA de bloques, no un texto suelto. El
 * modelo anterior —`content.text`, una cadena— no puede representar «texto,
 * imagen, texto», que es lo que el producto necesita.
 *
 * FUENTE ÚNICA DE VERDAD: `config.items`.
 *
 * `content.text` solo se lee para no romper los nodos guardados antes de esto,
 * y el editor lo retira en la primera escritura para que la misma información
 * no quede nunca en dos sitios. `data.preview` es un resumen DERIVADO de esta
 * secuencia y no se escribe jamás dentro de ella.
 */

/** Bloques que un Mensaje puede contener. */
export type MessageItemKind = "text" | "image" | "video" | "audio" | "file" | "interval";

/** Bloques cuyo contenido es un archivo referenciado por enlace. */
export type MessageMediaKind = "image" | "video" | "audio" | "file";

/** Unidades en las que se expresa una pausa entre bloques. */
export type MessageIntervalUnit = "seconds" | "minutes" | "hours";

interface MessageItemBase {
  /**
   * Identidad estable del bloque dentro de la secuencia.
   *
   * La exige el reordenamiento: sin una clave que no cambie, React re-monta los
   * campos al mover un bloque y el usuario pierde el foco y el cursor a mitad
   * de escribir.
   */
  readonly id: string;
}

/** Texto. Es el único bloque que el motor sabe enviar hoy. */
export interface MessageTextItem extends MessageItemBase {
  readonly kind: "text";
  readonly text: string;
}

/**
 * Imagen, video, audio o archivo.
 *
 * El archivo se referencia por ENLACE, no por carga. Es deliberado: no existe
 * almacenamiento de medios en ninguna capa del sistema —`infrastructure/storage`
 * es un directorio vacío—, así que un `assetId` apuntaría a un sitio que no
 * existe y habría que romperlo el día que exista de verdad. Un enlace, en
 * cambio, es un dato real que el usuario puede dar hoy y que un adaptador de
 * canal futuro podrá usar sin migración.
 */
export interface MessageMediaItem extends MessageItemBase {
  readonly kind: MessageMediaKind;
  /** Enlace al archivo. Vacío mientras no se ha elegido ninguno. */
  readonly url: string;
  /**
   * Nombre del archivo que el usuario eligió de su dispositivo.
   *
   * DOS FUENTES, UNA BASTA. Un medio queda configurado con un enlace o con un
   * archivo; este campo es la representación del segundo caso, y existe porque
   * antes no había ninguna: el archivo vivía en el estado de un componente, así
   * que nada fuera de él —ni la validación, ni el resumen, ni el preview— podía
   * saber que el usuario ya había elegido algo.
   *
   * Guarda el NOMBRE, no el contenido. Los bytes viven en la memoria del
   * navegador y no sobreviven a recargar; el nombre sí viaja con la
   * configuración y deja constancia de la elección durante la sesión.
   *
   * En Fase C, subir el archivo rellenará `url` y este campo se quedará como lo
   * que siempre fue: el nombre con el que enseñarlo. La regla de validación no
   * cambia.
   */
  readonly fileName?: string;
  readonly caption: string;
  /**
   * Enviar este archivo una sola vez por conversación.
   *
   * Se guarda en la configuración del bloque para que el motor pueda
   * respetarlo cuando exista el registro de lo ya enviado. Hoy nadie lo lee:
   * es el dato, modelado y persistido, no el comportamiento.
   */
  readonly sendOnce: boolean;
}

/**
 * Pausa entre dos bloques del mismo mensaje.
 *
 * NO es el nodo Intervalo del lienzo, que suspende la sesión entera: son dos
 * cosas distintas y por eso no comparten modelo. Su duración se guarda; cómo se
 * ejecuta se decidirá al construir esa herramienta.
 */
export interface MessageIntervalItem extends MessageItemBase {
  readonly kind: "interval";
  readonly amount: number;
  readonly unit: MessageIntervalUnit;
}

export type MessageItem = MessageTextItem | MessageMediaItem | MessageIntervalItem;

/** Configuración completa de un nodo Mensaje. */
export interface MessageConfig {
  readonly items: ReadonlyArray<MessageItem>;
}
