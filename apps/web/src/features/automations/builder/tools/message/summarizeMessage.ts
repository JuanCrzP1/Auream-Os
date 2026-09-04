import { MESSAGE_ITEM_LABELS } from "./messageItems";
import { readMessageItems } from "./readMessageConfig";

/**
 * Resumen de un Mensaje para la tarjeta del lienzo.
 *
 * DERIVADO, nunca fuente de verdad. La verdad es `config.items`; esto es una
 * lectura suya. Antes ocurría al revés —el texto de la tarjeta ERA el
 * contenido— y por eso un nodo no podía tener más de una cosa dentro.
 *
 * Prioriza el primer texto porque es lo que el usuario reconoce de un vistazo;
 * el recuento solo aparece cuando hay más de un bloque, para no llenar la
 * tarjeta de metadatos cuando el mensaje es simple.
 */
export function summarizeMessage(
  content: Readonly<Record<string, unknown>>,
  config: Readonly<Record<string, unknown>>
): string {
  const items = readMessageItems(config, content);

  if (items.length === 0) return "Mensaje vacío";

  const primerTexto = items.find((item) => item.kind === "text");
  const cabeza =
    primerTexto && primerTexto.kind === "text" && primerTexto.text.trim().length > 0
      ? primerTexto.text.trim()
      : MESSAGE_ITEM_LABELS[items[0].kind];

  if (items.length === 1) return cabeza;

  return `${cabeza} · ${items.length} bloques`;
}
