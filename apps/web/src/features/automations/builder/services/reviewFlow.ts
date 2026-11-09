import { reviewFlow as reviewGraph, type FlowIssue, type FlowIssueCode, type FlowIssueSeverity, type FlowReview } from "@contracts/blocks/reviewFlow";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { toGraphEdge, toGraphNode } from "./canvasGraph";

// Revisión del flujo del lienzo. Las reglas son las compartidas
// (`contracts/blocks/reviewFlow.ts`): el agente que edita por MCP recibe los
// mismos avisos. Aquí solo se traduce el lienzo al grafo.

export type { FlowIssue, FlowIssueCode, FlowIssueSeverity, FlowReview };

export function reviewFlow(nodes: ReadonlyArray<CanvasNode>, edges: ReadonlyArray<CanvasEdge>): FlowReview {
  return reviewGraph(nodes.map(toGraphNode), edges.map(toGraphEdge));
}
