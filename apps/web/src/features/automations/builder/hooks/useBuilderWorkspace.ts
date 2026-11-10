import { useMemo } from "react";
import { mapCanvasToSnapshot } from "../adapters/mapCanvasToSnapshot";
import { useBuilderAutosave } from "./builder/useBuilderAutosave";
import { useBuilderLoader } from "./builder/useBuilderLoader";
import { useBuilderController } from "./useBuilderController";

/**
 * useBuilderWorkspace — coordinador liviano del editor visual.
 *
 * Responsabilidad única: orquestar los hooks especializados y exponer
 * una API unificada a BuilderPage. No contiene lógica propia.
 *
 * Hooks que coordina:
 *  - useBuilderLoader     → carga inicial
 *  - useBuilderController → estado del canvas
 *  - useBuilderAutosave   → persistencia automática (no hay publicación:
 *                           lo guardado es lo que corre)
 *
 * El laboratorio de pruebas (`lab/useFlowLab`) prueba `currentDraft`: lo que
 * está en el lienzo, guardado o no.
 */
export function useBuilderWorkspace(flowKey: string, options: { readonly readOnly?: boolean } = {}) {
  const { workspace, loading, error, serverSignature, offline, setWorkspace, renameFlow } =
    useBuilderLoader(flowKey);

  const controller = useBuilderController(workspace?.draft ?? null);

  // Memoizados los dos: el borrador es la entrada del autoguardado, y si su
  // identidad cambiase en cada render el debounce nunca llegaría a cumplirse
  // —cada render reiniciaría el temporizador—. Solo debe cambiar cuando cambia
  // el grafo o el workspace cargado.
  const currentDraft = useMemo(
    () => (workspace ? mapCanvasToSnapshot(workspace.draft, controller.nodes, controller.edges) : null),
    [workspace, controller.nodes, controller.edges]
  );

  const autosaveStatus = useBuilderAutosave({
    flowKey,
    draft: currentDraft,
    // Lo que el servidor tiene, no lo que hay en pantalla. Ver `useBuilderLoader`.
    seedSignature: serverSignature,
    seedRevision: workspace?.autosaveRevision ?? null,
    // Sin servidor no hay a dónde guardar: intentarlo solo produciría errores.
    // En solo lectura (sin `flows.write`) nunca se guarda: la API lo rechazaría.
    enabled: workspace !== null && !offline && !options.readOnly,
    onSaved: setWorkspace
  });

  return {
    // Carga
    loading,
    error,
    offline,
    // Canvas
    flowName: controller.flowName,
    nodes: controller.nodes,
    edges: controller.edges,
    review: controller.review,
    autosaveStatus,
    // Handlers del canvas
    handleNodesChange: controller.handleNodesChange,
    handleEdgesChange: controller.handleEdgesChange,
    handleConnect: controller.handleConnect,
    handleSelectNode: controller.handleSelectNode,
    handleSelectEdge: controller.handleSelectEdge,
    handleAddNode: controller.handleAddNode,
    handleDropNode: controller.handleDropNode,
    handleRemoveNode: controller.handleRemoveNode,
    handleUpdateNode: controller.handleUpdateNode,
    handleDuplicateNode: controller.handleDuplicateNode,
    handleToggleNodeExpanded: controller.handleToggleNodeExpanded,
    handleCollapseNodes: controller.handleCollapseNodes,
    // Acciones del workspace
    handleRenameFlow: renameFlow,
    /** Lo que está en el lienzo ahora (lo que prueba el laboratorio). */
    currentDraft
  };
}
