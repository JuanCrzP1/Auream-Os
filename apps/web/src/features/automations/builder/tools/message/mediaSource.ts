import type { MessageItem } from "./types";

// ---------------------------------------------------------------------------
// Las FUENTES de un medio.
//
// Un bloque de imagen, video, audio o archivo se configura de dos maneras y
// solo hace falta una: un ENLACE, que es un dato y sobrevive a todo, o un
// ARCHIVO del dispositivo, que son bytes que viven en la memoria del navegador.
//
// Este módulo responde a las preguntas que se hacen sobre esas fuentes y que
// más de una capa necesita. Estaban contestadas por separado —la validación
// tenía su copia y el preview del lienzo la suya, con un comentario que decía
// «el mismo criterio que usa la validación» y nada que lo garantizara—. Dos
// copias de una regla son dos reglas en cuanto alguien toca una: un bloque
// podría dejar de valer para guardar y seguir pintando su miniatura, o al
// revés.
//
// ES DE MENSAJE, y aquí se queda. No es infraestructura del constructor: otra
// herramienta con medios decidirá si esta regla le sirve, y si le sirve la
// importará. Subirla ahora a una capa común sería inventar un contrato para un
// solo cliente.
// ---------------------------------------------------------------------------

/**
 * `true` si el enlace es uno que el navegador puede pedir.
 *
 * Solo `http` y `https`. Un `ftp:`, un `javascript:` o un texto suelto no son
 * cosas que se puedan enviar ni pintar, así que no cuentan como fuente.
 */
export function esEnlaceUsable(url: string): boolean {
  const limpio = url.trim();
  if (limpio.length === 0) return false;

  try {
    const { protocol } = new URL(limpio);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * El mismo bloque, sin la referencia a un archivo del dispositivo.
 *
 * POR QUÉ EXISTE: los bytes de un archivo se guardan aparte, indexados por la
 * identidad del bloque, y una copia estrena identidad. Copiar `fileName` tal
 * cual dejaba un bloque que DICE tener un archivo y no tiene ninguno: la
 * validación lo daba por bueno, el preview no encontraba nada que pintar y al
 * publicar no habría qué subir. Un estado que se contradice a sí mismo.
 *
 * Se elige perder el archivo en la copia, que es honesto y visible —la copia
 * pide que se elija uno—, en vez de fingir que lo tiene. El ENLACE sí se
 * conserva: es un dato, no una referencia a memoria, y copiarlo es exacto.
 */
export function sinArchivoLocal<T extends MessageItem>(item: T): T {
  if (item.kind === "text" || item.kind === "interval") return item;
  if (!item.fileName) return item;

  return { ...item, fileName: "" };
}
