import "./node-expanded.css";
import { useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import type { ToolDefinition } from "@features/automations/builder/tools/ToolDefinition";
import type { ToolUi } from "@features/automations/builder/tools/ToolUi";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

interface NodeExpandedFrameProps {
  readonly nodeId: string;
  readonly data: CanvasNode["data"];
  readonly tool: ToolDefinition;
  readonly ui: ToolUi;
  readonly onChange: (patch: NodePatch) => void;
  readonly onClose: () => void;
}

/**
 * Marco de configuración de un nodo abierto.
 *
 * Es TRANSVERSAL: da a todas las herramientas la misma cabecera, el mismo
 * cierre, las mismas dimensiones y la misma relación con el lienzo. Lo único
 * que cambia entre una herramienta y otra es lo que va dentro, y eso lo aporta
 * la herramienta a través del registry de UI.
 *
 * Este archivo NO conoce ninguna herramienta concreta. Si alguna vez aparece
 * aquí un `if` por tipo de nodo, la frontera se ha roto.
 *
 * Los `Handle` se repiten aquí en lugar de heredarse del estado compacto porque
 * el nodo cambia de tamaño y sus conexiones deben engancharse a los bordes del
 * marco nuevo. `useUpdateNodeInternals` avisa a React Flow de ese cambio: sin
 * él, las aristas seguirían apuntando a las coordenadas del nodo pequeño hasta
 * el siguiente movimiento.
 */
export function NodeExpandedFrame({
  nodeId,
  data,
  tool,
  ui,
  onChange,
  onClose
}: NodeExpandedFrameProps) {
  const updateNodeInternals = useUpdateNodeInternals();
  const Editor = ui.Editor;

  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, updateNodeInternals]);

  // Escape cierra. Es la salida que se espera de cualquier cosa que se abre, y
  // la única que no exige apuntar con el ratón.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <article className="node-expanded" style={{ borderColor: tool.colors.header }}>
      <Handle type="target" position={Position.Left} className="flow-node__handle flow-node__handle--target" />

      {/* Único punto por el que se arrastra el nodo abierto: `dragHandle` apunta
          a esta clase. Sin esa acotación, seleccionar texto en un campo movería
          el nodo por el lienzo. */}
      <header className="node-expanded__header" style={{ background: tool.colors.header }}>
        <span className="node-expanded__icon" aria-hidden="true">
          <ui.Icon />
        </span>
        <span className="node-expanded__title">{data.title}</span>
        <button
          type="button"
          className="node-expanded__close nodrag"
          onClick={onClose}
          title="Cerrar"
          aria-label={`Cerrar ${data.title}`}
        >
          ✕
        </button>
      </header>

      {/* `nodrag` libera el gesto de arrastre para el contenido; `nowheel` deja
          que la rueda del ratón desplace aquí dentro en vez de hacer zoom en el
          lienzo. Las dos son necesarias para que un formulario sea usable
          dentro de un nodo. */}
      <div className="node-expanded__body nodrag nowheel">
        {Editor ? (
          <Editor
            draft={{ name: data.title, content: data.content, config: data.config }}
            onChange={onChange}
          />
        ) : (
          <p className="node-expanded__empty">
            Esta herramienta todavía no tiene configuración propia.
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="flow-node__handle flow-node__handle--source" />
    </article>
  );
}
