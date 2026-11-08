import { useCallback, useDeferredValue, useEffect, useMemo } from "react";
import type { Connection } from "@xyflow/react";
import { mapSnapshotToCanvas } from "../adapters/mapSnapshotToCanvas";
import { releaseNodeResources } from "../services/releaseNodeResources";
import { reviewFlow } from "../services/reviewFlow";
import { checkConnection } from "../services/connectionRules";
import type { NodeType, BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import { useCanvasEdges } from "./canvas/useCanvasEdges";
import { useCanvasNodes } from "./canvas/useCanvasNodes";
import { useCanvasSelection } from "./canvas/useCanvasSelection";

/**
 * Coordinador principal del canvas del builder.
 *
 * Compone los tres hooks especializados (selection, nodes, edges)
 * y expone la API pública que consume la página del builder.
 *
 * Este hook NO contiene lógica de negocio: delega en los sub-hooks.
 */
export function useBuilderController(snapshot: BuilderFlowSnapshot | null) {
  const initialCanvas = snapshot ? mapSnapshotToCanvas(snapshot) : { nodes: [], edges: [] };

  const selection = useCanvasSelection();
  const nodesCtx = useCanvasNodes(initialCanvas.nodes, selection.selectedNodeId);
  const edgesCtx = useCanvasEdges(initialCanvas.edges);

  // Reinicializar el canvas cuando llega otro snapshot (la carga inicial).
  useEffect(() => {
    if (!snapshot) return;
    const nextCanvas = mapSnapshotToCanvas(snapshot);
    nodesCtx.setNodes(nextCanvas.nodes);
    edgesCtx.setEdges(nextCanvas.edges);
    selection.clearSelection();
    // Depende sólo de la versión: setNodes, setEdges y clearSelection son refs
    // estables y añadirlas reinicializaría el canvas en cada render.
  }, [snapshot?.version.id]);

  // Cada cambio de nodos (guardar una config que retira una salida, borrar un
  // nodo con Suprimir...) puede dejar aristas sin origen válido. Un único punto
  // las limpia, para todas las herramientas.
  useEffect(() => {
    edgesCtx.pruneEdges(nodesCtx.nodes);
  }, [nodesCtx.nodes, edgesCtx.pruneEdges]);

  const deferredNodes = useDeferredValue(nodesCtx.nodes);
  const deferredEdges = useDeferredValue(edgesCtx.edges);

  // Recorre el grafo entero: memoizado sobre el grafo diferido para no
  // pagarlo en cada render ni en cada pulsación.
  const review = useMemo(() => reviewFlow(deferredNodes, deferredEdges), [deferredNodes, deferredEdges]);

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

      // Antes de que el nodo desaparezca, se le da a su herramienta la ocasión
      // de soltar lo que tuviera reservado fuera de la configuración. Va aquí
      // —y no dentro de `removeNode`— porque este es el punto que compone el
      // borrado completo, y va ANTES porque después ya no habría nodo al que
      // preguntar. El lienzo sigue sin saber de qué herramienta se trata.
      const nodo = nodesCtx.nodes.find((n) => n.id === nodeId);
      if (nodo) releaseNodeResources(nodo);

      nodesCtx.removeNode(nodeId);
      edgesCtx.removeEdgesOfNode(nodeId);
    },
    [nodesCtx.nodes, nodesCtx.canRemoveNode, nodesCtx.removeNode, edgesCtx.removeEdgesOfNode]
  );

  return {
    flowName: snapshot?.flow.name ?? "Cargando flow...",
    nodes: nodesCtx.nodes,
    edges: edgesCtx.edges,
    review,
    handleNodesChange: nodesCtx.handleNodesChange,
    handleEdgesChange: edgesCtx.handleEdgesChange,
    // Segunda barrera de las reglas de conexión: el lienzo ya las aplica al
    // arrastrar, pero ninguna conexión entra al grafo sin pasar por aquí.
    handleConnect: (connection: Connection) => {
      if (checkConnection(nodesCtx.nodes, edgesCtx.edges, connection).ok) edgesCtx.handleConnect(connection);
    },
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
    handleCollapseNodes: nodesCtx.collapseNodes
  };
}


