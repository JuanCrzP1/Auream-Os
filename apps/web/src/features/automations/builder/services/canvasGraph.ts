import type { GraphEdge, GraphNode } from "@contracts/blocks/FlowGraph";
import type { CanvasEdge, CanvasNode } from "../types/canvas";

// El lienzo visto como el grafo que entienden las reglas compartidas
// (`contracts/blocks`): conexiones, revisión del flujo.

export function toGraphNode(node: CanvasNode): GraphNode {
  return { id: node.id, type: node.data.nodeType, name: node.data.title, content: node.data.content, config: node.data.config, isEntry: Boolean(node.data.isEntry) };
}

export function toGraphEdge(edge: Pick<CanvasEdge, "id" | "source" | "target" | "sourceHandle">): GraphEdge {
  return { id: edge.id, source: edge.source, target: edge.target, output: edge.sourceHandle ?? null };
}
