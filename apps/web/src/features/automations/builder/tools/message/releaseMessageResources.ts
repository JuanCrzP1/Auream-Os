import { readMessageItems } from "./readMessageConfig";
import { soltarArchivo } from "./mediaSourceSession";

/**
 * Suelta los archivos que los bloques de este mensaje tuvieran adjuntos.
 *
 * Los bytes de un archivo elegido del dispositivo no caben en la configuración
 * —no son serializables—, así que viven aparte, indexados por la identidad del
 * bloque. Borrar el nodo se llevaba la configuración y dejaba los bytes: nadie
 * podía volver a llegar a ellos y seguían ocupando memoria hasta recargar.
 *
 * Se recorre la secuencia con el mismo lector defensivo que usan el editor, el
 * preview y la validación: una configuración vieja o a medio migrar no debe
 * hacer fallar un borrado.
 *
 * `soltarArchivo` es idempotente, así que los bloques sin archivo —un texto,
 * una pausa, un medio con enlace— no cuestan nada.
 */
export function releaseMessageResources(config: Readonly<Record<string, unknown>>): void {
  for (const item of readMessageItems(config, {})) soltarArchivo(item.id);
}
