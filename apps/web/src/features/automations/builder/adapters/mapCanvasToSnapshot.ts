import type { CanvasEdge, CanvasNode } from "../types/canvas";
import type { BuilderFlowEdge, BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { ensureEdgeData } from "../services/ensureEdgeData";

export function mapCanvasToSnapshot(baseSnapshot: BuilderFlowSnapshot, nodes: CanvasNode[], edges: CanvasEdge[]): BuilderFlowSnapshot {
  const mappedNodes = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        id: node.id,
        type: node.data.nodeType,
        name: node.data.title,
        content: {
          ...node.data.content,
          text: node.data.preview
        },
        config: node.data.config,
        metadata: {
          ...node.data.metadata,
          ui: {
            x: node.position.x,
            y: node.position.y
          }
        }
      }
    ])
  );

  const nodeIdSet = new Set(nodes.map((n) => n.id));

  // Filtrar orphan edges — edges cuyo source o target no existen en el canvas.
  // Esto es una segunda línea de defensa: el borrado seguro en FlowNodeCard
  // ya elimina los edges al borrar un nodo, pero esta función garantiza que
  // la serialización nunca produzca un snapshot corrupto.
  const safeEdges = edges.filter(
    (edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
  );

  // Los contratos canónicos son readonly, así que se agrupa en arrays mutables
  // locales y el resultado se expone ya congelado por el tipo de retorno.
  const groupedEdges = safeEdges.reduce<Record<string, BuilderFlowEdge[]>>((accumulator, edge) => {
    const source = edge.source;
    const existing = accumulator[source] ?? [];
    const edgeData = ensureEdgeData(edge.data);

    existing.push({
      id: edge.id,
      fromNodeId: edge.source,
      toNodeId: edge.target,
      priority: edgeData.priority,
      isFallback: edgeData.isFallback,
      condition: edgeData.condition
    });

    accumulator[source] = existing.sort((left, right) => left.priority - right.priority);
    return accumulator;
  }, {});

  return {
    flow: baseSnapshot.flow,
    version: baseSnapshot.version,
    nodes: mappedNodes,
    edgesBySource: groupedEdges
  };
}