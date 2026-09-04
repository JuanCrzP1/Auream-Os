import { useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import { useBuilderEditing } from "@features/automations/builder/context/BuilderEditingContext";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { NodeExpandedFrame } from "./NodeExpandedFrame";

/**
 * Tarjeta de un nodo en el lienzo.
 *
 * Solo presentación y eventos: pinta lo que dice la herramienta y pide las
 * operaciones que necesita. No posee estado del grafo ni lo modifica: antes
 * llamaba a `useReactFlow().setNodes/setEdges` y era un segundo dueño del
 * estado a espaldas de `useCanvasNodes`.
 */
export function FlowNodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { requestEdit, toggleExpand, updateNode, duplicateNode, removeNode } = useBuilderEditing();
  // `resolveTool` degrada a una presentación neutra si el flow guardado trae un
  // tipo que esta versión ya no soporta, en lugar de romper el canvas entero.
  const tool = resolveTool(data.nodeType);
  const ui = resolveToolUi(data.nodeType);
  const colors = tool.colors;

  const handleChange = useCallback(
    (patch: NodePatch) => updateNode(id, patch),
    [id, updateNode]
  );

  const handleClose = useCallback(() => toggleExpand(id), [id, toggleExpand]);

  // `requestEdit` significa «abre el editor de este nodo», sin que la tarjeta
  // sepa si eso será dentro del lienzo o en el modal heredado. Esa decisión se
  // toma en un único sitio, para que el botón de editar y el doble clic del
  // lienzo no puedan acabar comportándose distinto.

  if (data.isExpanded && ui.Editor) {
    return (
      <NodeExpandedFrame
        nodeId={id}
        data={data}
        tool={tool}
        ui={ui}
        onChange={handleChange}
        onClose={handleClose}
      />
    );
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
        <span className="flow-node__type-icon" aria-hidden="true">{tool.glyph}</span>
        <span className="flow-node__name">{data.title}</span>
        <div className="flow-node__actions">
          <button
            type="button"
            className="flow-node__action-btn"
            title="Editar"
            aria-label={`Editar ${data.title}`}
            onClick={(e) => { e.stopPropagation(); requestEdit(id); }}
          >
            ✏
          </button>
          {/* Duplicar copia el nodo entero con su configuración. No aparece en
              el nodo de entrada: es único por definición —solo uno puede ser
              `entryNodeId`— y una copia sería un nodo que lo parece sin serlo.
              Esa rama del renderizado no llega aquí, pero el estado lo vuelve a
              comprobar: dos protecciones que no pueden divergir. */}
          <button
            type="button"
            className="flow-node__action-btn"
            title="Duplicar nodo"
            aria-label={`Duplicar ${data.title}`}
            onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5h-7a1 1 0 0 0-1 1v7" />
            </svg>
          </button>
          <button
            type="button"
            className="flow-node__action-btn flow-node__action-btn--delete"
            title="Eliminar"
            aria-label={`Eliminar ${data.title}`}
            onClick={(e) => { e.stopPropagation(); removeNode(id); }}
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
