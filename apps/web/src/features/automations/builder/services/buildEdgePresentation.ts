import { MarkerType } from "@xyflow/react";
import type { FlowEdgeData } from "../types/canvas";

export function buildEdgePresentation(edge: FlowEdgeData) {
  return {
    animated: edge.isFallback,
    label: edge.label,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: edge.isFallback ? "#f59e0b" : "#5eead4"
    },
    style: {
      stroke: edge.isFallback ? "#f59e0b" : "#5eead4",
      strokeWidth: edge.isFallback ? 2.8 : 2.3
    },
    labelStyle: {
      fill: edge.isFallback ? "#fcd34d" : "#cbd5e1",
      fontSize: 12,
      fontWeight: 700
    }
  };
}