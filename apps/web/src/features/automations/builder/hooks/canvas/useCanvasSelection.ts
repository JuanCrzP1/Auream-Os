import { startTransition, useState } from "react";

/**
 * Gestiona qué nodo y qué edge están seleccionados en el canvas.
 *
 * Invariante: selectedNodeId y selectedEdgeId no pueden ser ambos
 * no-null al mismo tiempo. Seleccionar uno limpia el otro.
 */
export function useCanvasSelection() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  function selectNode(nodeId: string | null): void {
    startTransition(() => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
    });
  }

  function selectEdge(edgeId: string | null): void {
    startTransition(() => {
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
    });
  }

  function clearSelection(): void {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    selectNode,
    selectEdge,
    clearSelection
  };
}
