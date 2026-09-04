import { useCallback, useDeferredValue, useEffect, useMemo } from "react";
import { mapSnapshotToCanvas } from "../adapters/mapSnapshotToCanvas";
import { buildStats } from "../services/buildStats";
import { validateCanvasGraph } from "../services/validateCanvasGraph";
import type { NodeType, BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { useCanvasEdges } from "./canvas/useCanvasEdges";
import { useCanvasNodes } from "./canvas/useCanvasNodes";
import { useCanvasSelection } from "./canvas/useCanvasSelection";

/**
 * Coordinador principal del canvas del builder.
 *
 * Compone los tres hooks especializados (selection, nodes, edges)
 * y expone la API pública que consume el canvas y los paneles laterales.
 *
 * Este hook NO contiene lógica de negocio: delega en los sub-hooks.
 */
export function useBuilderController(snapshot: BuilderFlowSnapshot | null) {
  const initialCanvas = snapshot ? mapSnapshotToCanvas(snapshot) : { nodes: [], edges: [] };

  const selection = useCanvasSelection();
  const nodesCtx = useCanvasNodes(initialCanvas.nodes, selection.selectedNodeId);
  const edgesCtx = useCanvasEdges(initialCanvas.edges, selection.selectedEdgeId);

  // Reinicializar el canvas cuando cambia la versión del snapshot (p.ej. tras rollback)
  useEffect(() => {
    if (!snapshot) return;
    const nextCanvas = mapSnapshotToCanvas(snapshot);
    nodesCtx.setNodes(nextCanvas.nodes);
    edgesCtx.setEdges(nextCanvas.edges);
    selection.clearSelection();
    // Depende sólo de la versión: setNodes, setEdges y clearSelection son refs
    // estables y añadirlas reinicializaría el canvas en cada render.
  }, [snapshot?.version.id]);

  const deferredNodes = useDeferredValue(nodesCtx.nodes);
  const deferredEdges = useDeferredValue(edgesCtx.edges);

  // Ambos recorren el grafo entero. Sin memoizar se recalculaban en CADA
  // render —incluido un simple cambio del estado de guardado—, así que en un
  // flujo grande se pagaba O(V+E) por pulsación. Con `useMemo` solo se
  // recalculan cuando el grafo cambia de verdad.
  //
  // No se eliminan aunque hoy nadie los consuma: son la entrada de los paneles
  // de validación y de estadísticas, que existen y se montarán en B6. Quitarlos
  // ahora obligaría a reconstruirlos entonces.
  const stats = useMemo(() => buildStats(deferredNodes, deferredEdges), [deferredNodes, deferredEdges]);
  const validation = useMemo(
    () => validateCanvasGraph(deferredNodes, deferredEdges),
    [deferredNodes, deferredEdges]
  );

  /**
   * Borra un nodo y todo lo que colgaba de él.
   *
   * Cada hook toca solo su propio estado; aquí se componen las dos mitades. La
   * selección se corrige sola: `selectedNode` se deriva buscando el id en la
   * lista, así que al desaparecer el nodo pasa a `null` sin necesidad de
   * sincronizar un segundo estado.
   *
   * El nodo de entrada aborta las DOS mitades. `removeNode` ya se protege solo,
   * pero sin esta comprobación las conexiones se irían igualmente y el nodo
   * sobreviviría desconectado: una corrupción silenciosa peor que el borrado.
   */
  const handleRemoveNode = useCallback(
    (nodeId: string) => {
      if (!nodesCtx.canRemoveNode(nodeId)) return;

      nodesCtx.removeNode(nodeId);
      edgesCtx.removeEdgesOfNode(nodeId);
    },
    [nodesCtx.canRemoveNode, nodesCtx.removeNode, edgesCtx.removeEdgesOfNode]
  );

  return {
    flowName: snapshot?.flow.name ?? "Cargando flow...",
    versionLabel: snapshot ? `v${snapshot.version.versionNumber}` : "--",
    nodes: nodesCtx.nodes,
    edges: edgesCtx.edges,
    stats,
    validation,
    selectedNode: nodesCtx.selectedNode,
    selectedEdge: edgesCtx.selectedEdge,
    handleNodesChange: nodesCtx.handleNodesChange,
    handleEdgesChange: edgesCtx.handleEdgesChange,
    handleConnect: edgesCtx.handleConnect,
    handleSelectNode: selection.selectNode,
    handleSelectEdge: selection.selectEdge,
    handleAddNode: (nodeType: NodeType) => {
      const nodeId = nodesCtx.addNode(nodeType);
      selection.selectNode(nodeId);
    },
    handleDropNode: nodesCtx.dropNode,
    handleRemoveNode,
    handleUpdateNode: nodesCtx.updateNode,
    handleDuplicateNode: nodesCtx.duplicateNode,
    handleToggleNodeExpanded: nodesCtx.toggleNodeExpanded,
    handleCollapseNodes: nodesCtx.collapseNodes,
    handleUpdateSelectedEdge: edgesCtx.updateSelectedEdge
  };
}


