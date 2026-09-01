import "../components/builder-shell/builder-topbar.css";
import "./builder-page.css";
import { useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { BuilderCanvas } from "../components/canvas/BuilderCanvas";
import { NodeEditorModal } from "../components/editor/NodeEditorModal";
import { BuilderShell } from "../components/builder-shell/BuilderShell";
import { FlowNameEditor } from "../components/builder-shell/FlowNameEditor";
import { SaveStatusPill } from "../components/builder-shell/SaveStatusPill";
import { PalettePanel } from "../components/panels/PalettePanel";
import { BuilderEditingProvider } from "../context/BuilderEditingContext";
import { useBuilderWorkspace } from "../hooks/useBuilderWorkspace";
import type { CanvasNode } from "../types/canvas";

function BuilderView({ flowKey }: { flowKey: string }) {
  const navigate = useNavigate();
  const builder = useBuilderWorkspace(flowKey);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editingNode = builder.nodes.find((n: CanvasNode) => n.id === editingNodeId) ?? null;

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
          sobre el grafo. Las dos referencias son estables —`setEditingNodeId`
          es un setter de estado y `handleRemoveNode` está memoizado— para que
          el contexto no re-renderice todo el lienzo en cada cambio. */}
      <BuilderEditingProvider requestEdit={setEditingNodeId} removeNode={builder.handleRemoveNode}>
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
            <SaveStatusPill status={builder.autosaveStatus} />
          </div>
          {/* La topbar no lleva publicar, versión ni rollback: el modelo del
              builder es editar → autoguardar. Versionado e historial se
              construirán cuando exista persistencia real. Las capacidades
              siguen existiendo fuera de aquí (`useBuilderPublishing`,
              `ReleasePanel`) y se expondrán al montar los paneles. */}
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
            onEditNode={setEditingNodeId}
            onDropNode={builder.handleDropNode}
          />
          <PalettePanel onAddNode={builder.handleAddNode} />
        </div>
      </div>
      </BuilderEditingProvider>
      {editingNode ? (
        <NodeEditorModal
          node={editingNode}
          onClose={() => setEditingNodeId(null)}
          onSave={(draft: { title: string; preview: string }) => {
            builder.handleUpdateSelectedNode("title", draft.title);
            builder.handleUpdateSelectedNode("preview", draft.preview);
            setEditingNodeId(null);
          }}
        />
      ) : null}
    </BuilderShell>
  );
}

export function BuilderPage() {
  const { flowKey } = useParams<{ flowKey: string }>();
  if (!flowKey) return <Navigate to="/automations" replace />;
  return <BuilderView flowKey={flowKey} />;
}
