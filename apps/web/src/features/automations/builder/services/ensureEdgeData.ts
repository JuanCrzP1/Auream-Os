import type { FlowEdgeData } from "../types/canvas";

export function ensureEdgeData(edgeData?: Partial<FlowEdgeData>): FlowEdgeData {
  return {
    priority: edgeData?.priority ?? 10,
    isFallback: edgeData?.isFallback ?? false,
    label: edgeData?.label ?? "Priority 10",
    condition: edgeData?.condition ?? { operator: "always" }
  };
}