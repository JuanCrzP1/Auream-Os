import type { ToolData } from "../ToolDefinition";
import { normalizeOutputId, type DistributorOutput } from "./distributorOutputs";

/**
 * Salidas legibles de un nodo Distribuidor.
 *
 * Defensivo: `config` es JSON de disco. Se descarta lo ilegible sin inventar
 * nada. Una salida sin id se descarta (su id ES el punto al que apuntan las
 * aristas; fabricar uno dejaría un punto colgando); un rótulo perdido se
 * repone por posición. Ids repetidos: se conserva el primero, para que dos
 * `Handle` no compartan identidad. Que el dato llegue así lo señala
 * `validateDistributor`.
 */
export function readDistributorOutputs(config: ToolData): DistributorOutput[] {
  const raw = config.outputs;
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const outputs: DistributorOutput[] = [];

  raw.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) return;

    const record = entry as Record<string, unknown>;
    const id = normalizeOutputId(record.id);
    if (id === null || seen.has(id)) return;
    seen.add(id);

    const label = typeof record.label === "string" ? record.label.trim() : "";
    outputs.push({ id, label: label.length > 0 ? label : `Salida ${index + 1}` });
  });

  return outputs;
}

/**
 * Nombre guardado de cada salida, sin reponer el de cortesía. Lo usa el
 * editor para que vaciar el campo y reescribirlo no devuelva «Salida n» bajo
 * el cursor.
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
