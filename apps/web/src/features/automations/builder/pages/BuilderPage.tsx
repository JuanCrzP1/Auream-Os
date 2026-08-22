import "../components/builder-shell/builder-topbar.css";
import "./builder-page.css";
import { useEffect, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { BuilderCanvas } from "../components/canvas/BuilderCanvas";
import { NodeEditorModal } from "../components/editor/NodeEditorModal";
import { BuilderShell } from "../components/builder-shell/BuilderShell";
import { PalettePanel } from "../components/panels/PalettePanel";
import { useBuilderWorkspace } from "../hooks/useBuilderWorkspace";
import { setEditCallback } from "../services/editCallbackStore";
import type { CanvasNode } from "../types/canvas";

function BuilderView({ flowKey }: { flowKey: string }) {
  const navigate = useNavigate();
  const builder = useBuilderWorkspace(flowKey);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const editingNode = builder.nodes.find((n: CanvasNode) => n.id === editingNodeId) ?? null;

  useEffect(() => {
    setEditCallback(setEditingNodeId);
    return () => setEditCallback(null);
  }, []);

  if (builder.loading) {
    return <div className="app-state">Cargando workspace...</div>;
  }

  if (builder.error) {
    return <div className="app-state">Error: {builder.error}</div>;
  }

  return (
    <BuilderShell>
      <PalettePanel isOpen={paletteOpen} onAddNode={builder.handleAddNode} />
      <div className="builder-stage">
        <header className="builder-topbar">
          <div className="builder-topbar__left">
            <button
              type="button"
              className="builder-topbar__back"
              onClick={() => navigate("/automations")}
              aria-label="Volver a automatizaciones"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              className="builder-topbar__palette-toggle"
              onClick={() => setPaletteOpen((v) => !v)}
              title={paletteOpen ? "Ocultar herramientas" : "Mostrar herramientas"}
              aria-label="Alternar panel de herramientas"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                {paletteOpen
                  ? <path d="M6 8l-2 4 2 4" />
                  : <path d="M13 8l2 4-2 4" />
                }
              </svg>
            </button>
            <span className="builder-topbar__name">{builder.flowName}</span>
            <span className="builder-topbar__save">
              {builder.autosaveStatus === "saving" ? "Guardando..." : "Guardado"}
            </span>
          </div>
          <div className="builder-topbar__right">
            <span className="builder-topbar__version">{builder.versionLabel}</span>
            <button
              type="button"
              className="builder-topbar__btn"
              onClick={() => void builder.handleRollback()}
            >
              Rollback
            </button>
            <button
              type="button"
              className="builder-topbar__publish"
              onClick={() => void builder.handlePublish()}
            >
              Publicar
            </button>
          </div>
        </header>
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
      </div>
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
