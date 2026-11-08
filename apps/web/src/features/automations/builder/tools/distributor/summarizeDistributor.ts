import type { ToolData } from "../ToolDefinition";
import { readDistributorOutputs } from "./readDistributorConfig";

/** «Sin salidas», «1 salida», «n salidas». Única forma de contarlas en el producto. */
export function describeOutputCount(count: number): string {
  if (count === 0) return "Sin salidas";
  return count === 1 ? "1 salida" : `${count} salidas`;
}

/** Resumen de una línea: cuenta las salidas, no las enumera. */
export function summarizeDistributor(_content: ToolData, config: ToolData): string {
  return describeOutputCount(readDistributorOutputs(config).length);
}
