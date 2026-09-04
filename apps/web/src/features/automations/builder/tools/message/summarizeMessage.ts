import { MESSAGE_ITEM_LABELS } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";

/**
 * Resumen de un Mensaje para la tarjeta del lienzo, cerrada.
 *
 * DERIVADO, nunca fuente de verdad. La verdad es `config.items`; esto es una
 * lectura suya, siempre a través de `readMessageItems` — nunca de
 * `content.text` directamente, ni del nodo antiguo que todavía pudiera
 * traerlo: ese caso ya lo resuelve el lector, convirtiéndolo en un único
 * bloque de texto, y aquí se trata igual que cualquier otro.
 *
 * FORMATO: «<Tipo> · <N> bloque(s)», SIEMPRE — también con un solo bloque. No
 * se enseña el contenido del primer bloque —ni su texto, ni su enlace—: la
 * tarjeta cerrada es un resumen, no una miniatura del editor. El tipo es el
 * del PRIMER bloque de la secuencia; es una regla simple y determinista, no
 * una clasificación nueva sobre contenido mixto.
 */
export function summarizeMessage(
  content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): string {
  const items = readMessageItems(config, content);

  if (items.length === 0) return "Mensaje vacío";

  const tipo = MESSAGE_ITEM_LABELS[items[0].kind];
  const unidad = items.length === 1 ? "bloque" : "bloques";

  return `${tipo} · ${items.length} ${unidad}`;
}
