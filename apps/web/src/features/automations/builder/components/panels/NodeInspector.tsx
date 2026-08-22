import "./panel-shell.css";
import "./inspector-panel.css";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

interface NodeInspectorProps {
  node: CanvasNode | null;
  onUpdateField: (field: "title" | "preview", value: string) => void;
}

export function NodeInspector({ node, onUpdateField }: NodeInspectorProps) {
  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel__header">
        <p>Inspector</p>
        <span>Configura el bloque seleccionado</span>
      </div>
      {node ? (
        <div className="inspector-form">
          <label>
            <span>Nombre</span>
            <input value={node.data.title} onChange={(event) => onUpdateField("title", event.target.value)} />
          </label>
          <label>
            <span>Preview</span>
            <textarea value={node.data.preview} onChange={(event) => onUpdateField("preview", event.target.value)} />
          </label>
          <dl className="inspector-meta">
            <div>
              <dt>Tipo</dt>
              <dd>{node.data.nodeType}</dd>
            </div>
            <div>
              <dt>Node ID</dt>
              <dd>{node.id}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{node.data.isTerminal ? "terminal" : "activo"}</dd>
            </div>
            <div>
              <dt>Config</dt>
              <dd>{node.data.configSummary}</dd>
            </div>
          </dl>
          <p className="inspector-tip">Tip: conecta desde el punto derecho del nodo hacia el punto izquierdo del siguiente bloque.</p>
        </div>
      ) : (
        <p className="empty-copy">Selecciona un nodo para editarlo.</p>
      )}
    </section>
  );
}