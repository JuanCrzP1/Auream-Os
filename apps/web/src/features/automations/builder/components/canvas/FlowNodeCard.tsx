import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import type { CanvasNode, FlowNodeData } from "@features/automations/builder/types/canvas";
import { triggerEdit } from "@features/automations/builder/services/editCallbackStore";

const colorByType: Record<FlowNodeData["nodeType"], { header: string; body: string }> = {
  message:   { header: "#2563eb", body: "#1d4ed8" },
  question:  { header: "#ea580c", body: "#c2410c" },
  capture:   { header: "#16a34a", body: "#15803d" },
  action:    { header: "#dc2626", body: "#b91c1c" },
  condition: { header: "#7c3aed", body: "#6d28d9" },
  delay:     { header: "#0891b2", body: "#0e7490" },
  fallback:  { header: "#d97706", body: "#b45309" },
  end:       { header: "#16a34a", body: "#15803d" },
  ai:        { header: "#9333ea", body: "#7e22ce" },
};

const iconByType: Record<FlowNodeData["nodeType"], string> = {
  message:   "💬",
  question:  "⏳",
  capture:   "📋",
  action:    "⚡",
  condition: "⬡",
  delay:     "⏱",
  fallback:  "🔄",
  end:       "✓",
  ai:        "✦",
};

export function FlowNodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { setNodes, setEdges } = useReactFlow();
  const colors = colorByType[data.nodeType];

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setNodes((current) => current.filter((n) => n.id !== id));
    setEdges((current) => current.filter((e) => e.source !== id && e.target !== id));
  }

  if (data.isEntry) {
    return (
      <article
        className={`flow-node flow-node--entry${selected ? " flow-node--selected" : ""}`}
      >
        <div className="flow-node__entry-inner">
          <span className="flow-node__entry-chip" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <polygon points="3,2 13,8 3,14"/>
            </svg>
          </span>
          <span className="flow-node__entry-label">{data.title}</span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="flow-node__handle flow-node__handle--source"
        />
      </article>
    );
  }

  return (
    <article
      className={`flow-node${selected ? " flow-node--selected" : ""}`}
      style={{ outline: selected ? `2px solid ${colors.header}` : "2px solid transparent", outlineOffset: "2px" }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="flow-node__handle flow-node__handle--target"
      />
      <header className="flow-node__header" style={{ background: colors.header }}>
        <span className="flow-node__type-icon" aria-hidden="true">{iconByType[data.nodeType]}</span>
        <span className="flow-node__name">{data.title}</span>
        <div className="flow-node__actions">
          <button
            type="button"
            className="flow-node__action-btn"
            title="Editar"
            onClick={(e) => { e.stopPropagation(); triggerEdit(id); }}
          >
            ✏
          </button>
          <button
            type="button"
            className="flow-node__action-btn"
            title="Duplicar"
            onClick={(e) => e.stopPropagation()}
          >
            ⧉
          </button>
          <button
            type="button"
            className="flow-node__action-btn flow-node__action-btn--delete"
            title="Eliminar"
            onClick={handleDelete}
          >
            ✕
          </button>
        </div>
      </header>
      <div className="flow-node__body" style={{ background: colors.body }}>
        <p className="flow-node__preview">{data.preview}</p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="flow-node__handle flow-node__handle--source"
      />
    </article>
  );
}
