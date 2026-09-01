import { useCallback, useState } from "react";
import { addEdge, applyEdgeChanges, type Connection, type OnEdgesChange } from "@xyflow/react";
import { buildEdgePresentation } from "@features/automations/builder/services/buildEdgePresentation";
import { ensureEdgeData } from "@features/automations/builder/services/ensureEdgeData";
import type { CanvasEdge } from "@features/automations/builder/types/canvas";

/**
 * Gestiona el estado de los edges del canvas y todas las operaciones sobre ellos.
 *
 * @param initialEdges   Edges iniciales (solo se usa en el primer render).
 * @param selectedEdgeId ID del edge actualmente seleccionado (manejado por useCanvasSelection).
 */
export function useCanvasEdges(initialEdges: CanvasEdge[], selectedEdgeId: string | null) {
  const [edges, setEdges] = useState<CanvasEdge[]>(initialEdges);

  const handleEdgesChange: OnEdgesChange<CanvasEdge> = (changes) => {
    setEdges((current) => applyEdgeChanges<CanvasEdge>(changes, current));
  };

  function handleConnect(connection: Connection): void {
    if (!connection.source || !connection.target) return;

    setEdges((current) =>
      addEdge<CanvasEdge>(
        {
          id: `edge-${connection.source}-${connection.target}-${current.length + 1}`,
          source: connection.source,
          target: connection.target,
          data: {
            priority: current.length + 10,
            isFallback: false,
            label: `Priority ${current.length + 10}`,
            condition: { operator: "always" }
          },
          ...buildEdgePresentation({
            priority: current.length + 10,
            isFallback: false,
            label: `Priority ${current.length + 10}`,
            condition: { operator: "always" }
          })
        },
        current
      )
    );
  }

  /**
   * Elimina las conexiones que entran o salen de un nodo.
   *
   * Es la mitad de un borrado de nodo que le corresponde a este hook, y la
   * primera línea de defensa contra conexiones huérfanas: `mapCanvasToSnapshot`
   * las filtra también al serializar, pero eso es una red de seguridad, no el
   * sitio donde debe corregirse el grafo.
   *
   * Estable por la misma razón que `removeNode`.
   */
  const removeEdgesOfNode = useCallback((nodeId: string): void => {
    setEdges((current) =>
      current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
  }, []);

  function updateSelectedEdge(
    field: "label" | "priority" | "fact" | "value" | "operator" | "fallback",
    value: string | number | boolean
  ): void {
    if (!selectedEdgeId) return;

    setEdges((current) =>
      current.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;

        const currentData = ensureEdgeData(edge.data);
        const nextData = {
          ...currentData,
          label: field === "label" ? String(value) : currentData.label,
          priority: field === "priority" ? Number(value) : currentData.priority,
          isFallback: field === "fallback" ? Boolean(value) : currentData.isFallback,
          condition: {
            ...currentData.condition,
            operator: field === "operator"
              ? String(value) as NonNullable<CanvasEdge["data"]>["condition"]["operator"]
              : currentData.condition.operator,
            fact: field === "fact" ? String(value) : currentData.condition.fact,
            value: field === "value" ? String(value) : currentData.condition.value
          }
        };

        return { ...edge, data: nextData, ...buildEdgePresentation(nextData) };
      })
    );
  }

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  return {
    edges,
    setEdges,
    selectedEdge,
    handleEdgesChange,
    handleConnect,
    removeEdgesOfNode,
    updateSelectedEdge
  };
}
