import type { ToolData } from "../ToolDefinition";
import { readGoToFlowConfig } from "./goToFlowConfig";

/** «Pasa a «dilo cantando Promoción»». */
export function summarizeGoToFlow(_content: ToolData, config: ToolData): string {
  const read = readGoToFlowConfig(config);
  if (!read.flowId) return "Sin flujo elegido";
  return `Pasa a «${read.flowName || "otro flujo"}»`;
}
