import "../components/builder-shell/builder-topbar.css";
import "./builder-page.css";
import { useCallback, useRef, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { BuilderCanvas } from "../components/canvas/BuilderCanvas";
import { BuilderShell } from "../components/builder-shell/BuilderShell";
import { FlowNameEditor } from "../components/builder-shell/FlowNameEditor";
import { SaveStatusPill } from "../components/builder-shell/SaveStatusPill";
import { OfflineNotice } from "../components/builder-shell/OfflineNotice";
import { PalettePanel } from "../components/panels/PalettePanel";
import { BuilderEditingProvider } from "../context/BuilderEditingContext";
import { useBuilderWorkspace } from "../hooks/useBuilderWorkspace";
import { resolveToolUi } from "../tools/ui-registry";
import type { CanvasNode } from "../types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

/** Medio ancho y medio alto aproximados de un bloque: se centra en el punto. */
const NODE_HALF_SIZE = { x: 132, y: 48 } as const;

interface BuilderViewProps {
  readonly flowKey: string;
  /** Vuelve a montar el builder desde cero (nueva carga del servidor). */
  readonly onReload: () => void;
}

function BuilderView({ flowKey, onReload }: BuilderViewProps) {
  const navigate = useNavigate();
  const builder = useBuilderWorkspace(flowKey);

  // Añadir desde la Toolbox con un toque: el bloque aparece en el centro de lo
  // que se está viendo, no en una posición fija que puede quedar fuera de la
  // pantalla (en un celular, casi siempre).
  const viewportCenter = useRef<(() => { x: number; y: number }) | null>(null);
  const registerViewportCenter = useCallback((getCenter: () => { x: number; y: number }) => {
    viewportCenter.current = getCenter;
  }, []);
  const addNodeAtCenter = useCallback(
    (nodeType: NodeType) => {
      const center = viewportCenter.current?.();
      if (!center) return builder.handleAddNode(nodeType);
      builder.handleDropNode(nodeType, { x: center.x - NODE_HALF_SIZE.x, y: center.y - NODE_HALF_SIZE.y });
    },
    [builder.handleAddNode, builder.handleDropNode]
  );

  /**
   * Abre el editor de un nodo dentro del lienzo. ÚNICO punto de decisión, para
   * que el lápiz de la tarjeta y el doble clic no puedan divergir.
   *
   * Solo se abre si la herramienta declara editor. Los nodos de sistema
   * (Inicio, Finalizar) no se configuran: el doble clic no hace nada.
   */
  const openNodeEditor = useCallback(
    (nodeId: string | null) => {
      const node = nodeId ? builder.nodes.find((n: CanvasNode) => n.id === nodeId) : undefined;
      if (node && resolveToolUi(node.data.nodeType).Editor) builder.handleToggleNodeExpanded(node.id);
    },
    [builder.nodes, builder.handleToggleNodeExpanded]
  );

  if (builder.loading) {
    return <div className="app-state">Cargando workspace...</div>;
  }

  if (builder.error) {
    return <div className="app-state">Error: {builder.error}</div>;
  }

  return (
    <BuilderShell>
      {/* Las tarjetas del lienzo las instancia React Flow: no les llegan props
          desde aquí. Este provider es su único canal para pedir operaciones
          sobre el grafo. Las referencias son estables (memoizadas) para que
          el contexto no re-renderice todo el lienzo en cada cambio. */}
      <BuilderEditingProvider
        requestEdit={openNodeEditor}
        toggleExpand={builder.handleToggleNodeExpanded}
        updateNode={builder.handleUpdateNode}
        duplicateNode={builder.handleDuplicateNode}
        removeNode={builder.handleRemoveNode}
      >
      <div className="builder-stage">
        <header className="builder-topbar">
          <div className="builder-topbar__left">
            <button
              type="button"
              className="builder-topbar__back"
              onClick={() => navigate("/automations")}
              aria-label="Volver a automatizaciones"
              title="Volver a automatizaciones"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <FlowNameEditor name={builder.flowName} onRename={builder.handleRenameFlow} />
            <SaveStatusPill status={builder.offline ? "offline" : builder.autosaveStatus} />
          </div>
          {/* Sin publicar, versión ni rollback: los flujos se autoguardan y lo
              guardado es lo que corre (ROADMAP, B6). */}
        </header>
        {/* Área de trabajo: el lienzo ocupa todo el ancho y la paleta flota
            encima. La paleta NO es una columna del layout. */}
        <div className="builder-workspace">
          <BuilderCanvas
            nodes={builder.nodes}
            edges={builder.edges}
            onNodesChange={builder.handleNodesChange}
            onEdgesChange={builder.handleEdgesChange}
            onConnect={builder.handleConnect}
            onSelectNode={builder.handleSelectNode}
            onSelectEdge={builder.handleSelectEdge}
            onEditNode={openNodeEditor}
            onDropNode={builder.handleDropNode}
            onPaneClick={builder.handleCollapseNodes}
            review={builder.review}
            registerViewportCenter={registerViewportCenter}
          />
          <PalettePanel onAddNode={addNodeAtCenter} />
          {builder.offline ? <OfflineNotice onRetry={onReload} /> : null}
        </div>
      </div>
      </BuilderEditingProvider>
    </BuilderShell>
  );
}

export function BuilderPage() {
  const { flowKey } = useParams<{ flowKey: string }>();
  // Reintentar = montar de nuevo: recarga del servidor y lienzo limpio. Así lo
  // editado sin conexión nunca se autoguarda encima del flujo real.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const reload = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  if (!flowKey) return <Navigate to="/automations" replace />;
  return <BuilderView key={`${flowKey}:${loadAttempt}`} flowKey={flowKey} onReload={reload} />;
}
