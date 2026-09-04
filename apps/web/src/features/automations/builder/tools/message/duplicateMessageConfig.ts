import { createMessageItem } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";

/**
 * Copia la configuración de un Mensaje para un nodo duplicado.
 *
 * Conserva TODO el contenido de cada bloque —texto, enlace, descripción,
 * duración, unidad, «enviar una sola vez»— y renueva únicamente la identidad.
 *
 * Los identificadores solo tienen que ser únicos DENTRO de un nodo, así que
 * repetirlos entre dos nodos no rompería nada hoy. Se renuevan igualmente
 * porque son identidad, no contenido: dos bloques distintos que comparten id
 * son una coincidencia esperando a convertirse en un error el día que algo los
 * indexe junto.
 */
export function duplicateMessageConfig(
  config: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const items = readMessageItems(config, {}).map((item) => ({
    ...item,
    // `createMessageItem` es la única fuente de identidades del módulo: se usa
    // por su id y se descarta el resto, en lugar de tener un segundo generador
    // que pueda divergir del primero.
    id: createMessageItem(item.kind).id
  }));

  return { ...config, items };
}
