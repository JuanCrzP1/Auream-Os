import { VALID, invalid, type ToolData, type ValidationResult } from "../ToolDefinition";
import { normalizeOutputId } from "./distributorOutputs";

export const DUPLICATE_OUTPUTS_MESSAGE =
  "Hay dos salidas con la misma identidad. Elimina una de las dos para poder guardar.";

export const UNREADABLE_OUTPUT_MESSAGE =
  "Una de las salidas está incompleta. Elimínala y vuelve a añadirla.";

/**
 * ¿Puede guardarse este Distribuidor?
 *
 * Mira el dato CRUDO, no el saneado por `readDistributorOutputs`: el lector
 * descarta justo lo que aquí hay que señalar.
 *
 * Cero salidas es válido (así nace el nodo). Si un nodo sin salidas puede
 * publicarse es una pregunta sobre el grafo, no sobre la herramienta.
 */
export function validateDistributor(_content: ToolData, config: ToolData): ValidationResult {
  const raw = config.outputs;
  if (!Array.isArray(raw)) return VALID;

  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return invalid(UNREADABLE_OUTPUT_MESSAGE);

    const id = normalizeOutputId((entry as Record<string, unknown>).id);
    if (id === null) return invalid(UNREADABLE_OUTPUT_MESSAGE);
    if (seen.has(id)) return invalid(DUPLICATE_OUTPUTS_MESSAGE);
    seen.add(id);
  }

  return VALID;
}
