import { mapCanvasToSnapshot } from "../adapters/mapCanvasToSnapshot";
import { useBuilderAutosave } from "./builder/useBuilderAutosave";
import { useBuilderLoader } from "./builder/useBuilderLoader";
import { useBuilderPublishing } from "./builder/useBuilderPublishing";
import { useBuilderSimulation } from "./builder/useBuilderSimulation";
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
 *  - useBuilderAutosave   → persistencia automática
 *  - useBuilderPublishing → publish / rollback
 *  - useBuilderSimulation → simulación
 */
export function useBuilderWorkspace(flowKey: string) {
  const { workspace, loading, error, setWorkspace } = useBuilderLoader(flowKey);

  const controller = useBuilderController(workspace?.draft ?? null);

  const currentDraft = workspace
    ? mapCanvasToSnapshot(workspace.draft, controller.nodes, controller.edges)
    : null;

  const autosaveStatus = useBuilderAutosave({
    flowKey,
    draft: currentDraft,
    seedSignature: workspace ? JSON.stringify(workspace.draft) : null,
    enabled: workspace !== null,
    onSaved: setWorkspace
  });

  const { handlePublish, handleRollback } = useBuilderPublishing({
    flowKey,
    onUpdate: setWorkspace
  });

  const { simulationLog, simulationStatus, handleSimulate, resetSimulation } =
    useBuilderSimulation({ flowKey });

  return {
    // Carga
    loading,
    error,
    // Canvas
    flowName: controller.flowName,
    versionLabel: controller.versionLabel,
    nodes: controller.nodes,
    edges: controller.edges,
    stats: controller.stats,
    validation: controller.validation,
    selectedNode: controller.selectedNode,
    selectedEdge: controller.selectedEdge,
    autosaveStatus,
    // Handlers del canvas
    handleNodesChange: controller.handleNodesChange,
    handleEdgesChange: controller.handleEdgesChange,
    handleConnect: controller.handleConnect,
    handleSelectNode: controller.handleSelectNode,
    handleSelectEdge: controller.handleSelectEdge,
    handleAddNode: controller.handleAddNode,
    handleDropNode: controller.handleDropNode,
    handleUpdateSelectedNode: controller.handleUpdateSelectedNode,
    // Acciones del workspace
    handlePublish,
    handleRollback,
    // Simulación
    simulationLog,
    simulationStatus,
    handleSimulate,
    resetSimulation
  };
}
