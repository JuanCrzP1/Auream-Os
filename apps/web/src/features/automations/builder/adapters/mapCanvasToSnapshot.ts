import type { CanvasEdge, CanvasNode } from "../types/canvas";
import type { BuilderFlowEdge, BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { ensureEdgeData } from "../services/ensureEdgeData";
import { pruneCanvasEdges } from "../services/nodeOutputs";

export function mapCanvasToSnapshot(baseSnapshot: BuilderFlowSnapshot, nodes: CanvasNode[], edges: CanvasEdge[]): BuilderFlowSnapshot {
  const mappedNodes = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        id: node.id,
        type: node.data.nodeType,
        name: node.data.title,
        // El contenido se serializa TAL CUAL. Antes se escribía aquí
        // `text: node.data.preview`, cuando el texto de la tarjeta ERA el
        // contenido y las dos cosas coincidían por construcción.
        //
        // Ya no: `preview` es un resumen DERIVADO de la configuración —«Hola ·
        // 3 contenidos»— y volcarlo aquí escribiría ese resumen dentro del
        // contenido real del nodo, machacándolo en cada guardado. La verdad la
        // escribe el mutador (`applyNodePatch`); este adaptador solo la copia.
        content: node.data.content,
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

  // Red de seguridad: el lienzo ya poda al cambiar los nodos, pero el
  // snapshot nunca debe salir con aristas a nodos o salidas inexistentes.
  const safeEdges = pruneCanvasEdges(nodes, edges);

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
      // Solo en aristas que salen de una salida con nombre.
      ...(edge.sourceHandle ? { fromOutput: edge.sourceHandle } : {}),
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