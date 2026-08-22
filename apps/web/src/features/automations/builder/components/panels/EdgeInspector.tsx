import "./panel-shell.css";
import "./inspector-panel.css";
import type { CanvasEdge } from "@features/automations/builder/types/canvas";
import { ensureEdgeData } from "@features/automations/builder/services/ensureEdgeData";

interface EdgeInspectorProps {
  edge: CanvasEdge | null;
  onUpdateField: (field: "label" | "priority" | "fact" | "value" | "operator" | "fallback", value: string | number | boolean) => void;
  onClose?: () => void;
}

export function EdgeInspector({ edge, onUpdateField, onClose }: EdgeInspectorProps) {
  const edgeData = edge ? ensureEdgeData(edge.data) : null;

  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel__header">
        <div>
          <p>Conexión</p>
          <span>Ruta, prioridad y fallback</span>
        </div>
        {onClose ? (
          <button type="button" className="sidebar-panel__close" aria-label="Cerrar editor de conexión" onClick={onClose}>
            x
          </button>
        ) : null}
      </div>
      {edge && edgeData ? (
        <div className="inspector-form">
          <label>
            <span>Etiqueta</span>
            <input value={edgeData.label} onChange={(event) => onUpdateField("label", event.target.value)} />
          </label>
          <label>
            <span>Prioridad</span>
            <input type="number" value={edgeData.priority} onChange={(event) => onUpdateField("priority", Number(event.target.value))} />
          </label>
          <label>
            <span>Operador</span>
            <select value={edgeData.condition.operator} onChange={(event) => onUpdateField("operator", event.target.value)}>
              <option value="always">always</option>
              <option value="eq">eq</option>
              <option value="neq">neq</option>
              <option value="exists">exists</option>
            </select>
          </label>
          <label>
            <span>Fact</span>
            <input value={edgeData.condition.fact ?? ""} onChange={(event) => onUpdateField("fact", event.target.value)} />
          </label>
          <label>
            <span>Valor</span>
            <input value={String(edgeData.condition.value ?? "")} onChange={(event) => onUpdateField("value", event.target.value)} />
          </label>
          <label className="inspector-toggle">
            <input type="checkbox" checked={edgeData.isFallback} onChange={(event) => onUpdateField("fallback", event.target.checked)} />
            <span>Usar como fallback</span>
          </label>
        </div>
      ) : (
        <p className="empty-copy">Selecciona una conexión para editar prioridad, condición y fallback.</p>
      )}
    </section>
  );
}