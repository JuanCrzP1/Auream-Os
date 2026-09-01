import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import { useBuilderEditing } from "@features/automations/builder/context/BuilderEditingContext";
import { resolveTool } from "@features/automations/builder/tools/registry";

/**
 * Tarjeta de un nodo en el lienzo.
 *
 * Solo presentación y eventos: pinta lo que dice la herramienta y pide las
 * operaciones que necesita. No posee estado del grafo ni lo modifica: antes
 * llamaba a `useReactFlow().setNodes/setEdges` y era un segundo dueño del
 * estado a espaldas de `useCanvasNodes`.
 */
export function FlowNodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { requestEdit, removeNode } = useBuilderEditing();
  // `resolveTool` degrada a una presentación neutra si el flow guardado trae un
  // tipo que esta versión ya no soporta, en lugar de romper el canvas entero.
  const tool = resolveTool(data.nodeType);
  const colors = tool.colors;

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
          {/* Aquí había un botón «Duplicar» que solo detenía la propagación del
              clic. Se retira en lugar de fingirlo: duplicar un nodo tiene
              decisiones de producto sin acordar —qué pasa con sus conexiones,
              con su condición de entrada— y no se inventan aquí. Volverá con
              el editor de herramientas (B5). */}
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
