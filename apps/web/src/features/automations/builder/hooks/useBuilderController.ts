import { useDeferredValue, useEffect } from "react";
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
  const stats = buildStats(deferredNodes, deferredEdges);
  const validation = validateCanvasGraph(deferredNodes, deferredEdges);

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
    handleUpdateSelectedNode: nodesCtx.updateSelectedNode,
    handleUpdateSelectedEdge: edgesCtx.updateSelectedEdge
  };
}


