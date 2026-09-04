import type { CanvasEdge, CanvasNode } from "../types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { buildEdgePresentation } from "../services/buildEdgePresentation";
import { summarizeNode } from "../services/summarizeNode";
import { isTerminalType } from "../tools/registry";

export function mapSnapshotToCanvas(snapshot: BuilderFlowSnapshot): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
} {
  const nodes = Object.values(snapshot.nodes).map<CanvasNode>((node) => {
    const ui = (node.metadata.ui as { x?: number; y?: number } | undefined) ?? {};
    const { preview, configSummary } = summarizeNode(node);
    const isEntry = snapshot.version.entryNodeId === node.id;

    return {
      id: node.id,
      type: "flowNode",
      position: {
        x: ui.x ?? 120,
        y: ui.y ?? 120
      },
      // El nodo de entrada no ofrece las afordancias de borrado de React Flow.
      // Es la capa declarativa de la protección: la que de verdad la sostiene
      // es `entryNodeProtection`, en el dueño del estado. Arrastrar sigue
      // permitido — mover no es borrar.
      deletable: !isEntry,
      data: {
        nodeType: node.type,
        title: node.name,
        preview,
        configSummary,
        isEntry,
        isTerminal: isTerminalType(node.type),
        content: node.content,
        config: node.config,
        metadata: node.metadata
      }
    };
  });

  const edges = Object.values(snapshot.edgesBySource)
    .flat()
    .map<CanvasEdge>((edge) => ({
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      data: {
        priority: edge.priority,
        isFallback: edge.isFallback,
        label: edge.isFallback ? "Fallback" : `Priority ${edge.priority}`,
        condition: edge.condition
      },
      ...buildEdgePresentation({
        priority: edge.priority,
        isFallback: edge.isFallback,
        label: edge.isFallback ? "Fallback" : `Priority ${edge.priority}`,
        condition: edge.condition
      })
    }));

  return { nodes, edges };
}