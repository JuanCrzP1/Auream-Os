import type { ToolData } from "../ToolDefinition";
// Las salidas en orden (= orden de los turnos) las lee el contrato compartido
// con el motor; aquí queda solo lo que necesita el editor.
export { readDistributorOutputs } from "@contracts/DistributorConfig";

/**
 * Rótulos TAL CUAL se guardaron (vacíos incluidos), por id. El editor los
 * necesita sin reponer: vaciar el campo no debe volver a «Salida n».
 */
export function readRawOutputLabels(config: ToolData): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  if (!Array.isArray(config.outputs)) return labels;

  for (const entry of config.outputs) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id === "string") labels.set(record.id.trim(), typeof record.label === "string" ? record.label : "");
  }
  return labels;
}
