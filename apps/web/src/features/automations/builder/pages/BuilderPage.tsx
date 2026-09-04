import "../components/builder-shell/builder-topbar.css";
import "./builder-page.css";
import { useCallback, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { BuilderCanvas } from "../components/canvas/BuilderCanvas";
import { NodeEditorModal } from "../components/editor/NodeEditorModal";
import { BuilderShell } from "../components/builder-shell/BuilderShell";
import { FlowNameEditor } from "../components/builder-shell/FlowNameEditor";
import { SaveStatusPill } from "../components/builder-shell/SaveStatusPill";
import { PalettePanel } from "../components/panels/PalettePanel";
import { BuilderEditingProvider } from "../context/BuilderEditingContext";
import { useBuilderWorkspace } from "../hooks/useBuilderWorkspace";
import { resolveToolUi } from "../tools/ui-registry";
import type { CanvasNode } from "../types/canvas";

function BuilderView({ flowKey }: { flowKey: string }) {
  const navigate = useNavigate();
  const builder = useBuilderWorkspace(flowKey);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const editingNode = builder.nodes.find((n: CanvasNode) => n.id === editingNodeId) ?? null;

  /**
   * Abre el editor de un nodo, dentro o fuera del lienzo.
   *
   * ÚNICO sitio donde se decide cuál de los dos caminos se toma, para que el
   * botón de la tarjeta y el doble clic del lienzo no puedan divergir.
   *
   * La decisión es genérica: se pregunta al registry si la herramienta declara
   * editor propio, no de qué tipo de nodo se trata. Las que ya lo declaran se
   * configuran DENTRO del lienzo; las que no, siguen abriendo el modal
   * heredado, que se retirará cuando todas lo declaren. Así ninguna herramienta
   * se queda entretanto sin forma de configurarse.
   */
  const openNodeEditor = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        setEditingNodeId(null);
        return;
      }

      const node = builder.nodes.find((n: CanvasNode) => n.id === nodeId);
      if (node && resolveToolUi(node.data.nodeType).Editor) {
        builder.handleToggleNodeExpanded(nodeId);
        return;
      }

      setEditingNodeId(nodeId);
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
          sobre el grafo. Las dos referencias son estables —`setEditingNodeId`
          es un setter de estado y `handleRemoveNode` está memoizado— para que
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
            onEditNode={openNodeEditor}
            onDropNode={builder.handleDropNode}
            onPaneClick={builder.handleCollapseNodes}
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
            // El modal sigue siendo el editor genérico de texto: entrega un
            // nombre y un contenido principal. La traducción a `content.text`
            // vive aquí de forma provisional y desaparece en P1.5, cuando el
            // modal pase a ser un shell y cada herramienta entregue su propio
            // `content` ya formado.
            builder.handleUpdateNode(editingNode.id, {
              name: draft.title,
              content: { ...editingNode.data.content, text: draft.preview }
            });
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
