import type { BuilderFlowEdge, BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { GraphEdge, GraphNode } from "../../../../contracts/blocks/FlowGraph";
import { reviewFlow, type FlowReview } from "../../../../contracts/blocks/reviewFlow";

// El borrador visto como el grafo de las reglas compartidas (`contracts/blocks`).

export function graphNodesOf(draft: BuilderFlowSnapshot): GraphNode[] {
  return Object.values(draft.nodes).map((node) => ({
    id: node.id,
    type: node.type,
    name: node.name,
    content: node.content,
    config: node.config,
    isEntry: node.id === draft.version.entryNodeId
  }));
}

export function allEdgesOf(draft: BuilderFlowSnapshot): BuilderFlowEdge[] {
  return Object.values(draft.edgesBySource).flat();
}

export function graphEdgesOf(draft: BuilderFlowSnapshot): GraphEdge[] {
  return allEdgesOf(draft).map((edge) => ({ id: edge.id, source: edge.fromNodeId, target: edge.toNodeId, output: edge.fromOutput ?? null }));
}

/** Lo mismo que muestra «Revisión del flujo» en el editor. */
export function reviewDraft(draft: BuilderFlowSnapshot): FlowReview {
  return reviewFlow(graphNodesOf(draft), graphEdgesOf(draft));
}

/** El borrador con las conexiones dadas (agrupadas por origen, como se guardan). */
export function withEdges(draft: BuilderFlowSnapshot, edges: ReadonlyArray<BuilderFlowEdge>): BuilderFlowSnapshot {
  const edgesBySource: Record<string, BuilderFlowEdge[]> = {};
  for (const edge of edges) (edgesBySource[edge.fromNodeId] ??= []).push(edge);
  for (const list of Object.values(edgesBySource)) list.sort((left, right) => left.priority - right.priority);
  return { ...draft, edgesBySource };
}
