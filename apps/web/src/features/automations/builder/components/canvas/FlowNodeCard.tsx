import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import { useBuilderEditing } from "@features/automations/builder/context/BuilderEditingContext";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";

/**
 * Tarjeta de un nodo en el lienzo.
 *
 * Solo presentación y eventos: pinta lo que dice la herramienta y pide las
 * operaciones que necesita. No posee estado del grafo ni lo modifica: antes
 * llamaba a `useReactFlow().setNodes/setEdges` y era un segundo dueño del
 * estado a espaldas de `useCanvasNodes`.
 *
 * SIEMPRE renderiza el nodo compacto —o la píldora de entrada—, esté o no
 * abierto su editor. `data.isExpanded` ya no cambia lo que este componente
 * devuelve: solo le dice a `ExpandedNodeOverlay` (montado aparte, en
 * `BuilderCanvas`) que tiene que aparecer flotando sobre el lienzo, anclado a
 * este mismo nodo. Antes esta tarjeta se SUSTITUÍA por el editor grande, y
 * como React Flow mide lo que sea que un nodo devuelve, el editor —980px—
 * pasaba a ser el bounding box real del nodo: sus handles se movían a las
 * esquinas del marco grande y las conexiones parecían saltar hasta ahí. Con
 * la tarjeta siempre compacta, los handles no se mueven nunca.
 */
export function FlowNodeCard({ id, data, selected }: NodeProps<CanvasNode>) {
  const { requestEdit, duplicateNode, removeNode } = useBuilderEditing();
  // `resolveTool` degrada a una presentación neutra si el flow guardado trae un
  // tipo que esta versión ya no soporta, en lugar de romper el canvas entero.
  const tool = resolveTool(data.nodeType);
  const colors = tool.colors;
  // Mismo catálogo visual que ya consumen la paleta y el nodo expandido: el
  // icono del nodo cerrado no puede ser un tercer mapa `tool === "message" ? …`
  // sino el mismo SVG oficial, resuelto por tipo igual que en todas partes.
  const { Icon, CompactBody } = resolveToolUi(data.nodeType);

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
      /* El color de la herramienta se PUBLICA, no se aplica.
       *
       * Antes esta tarjeta escribía `background: <color>` directamente en la
       * cabecera y en el cuerpo, y un estilo en línea gana a cualquier hoja:
       * ninguna regla podía convertir esa superficie en cristal, ni darle
       * profundidad, ni dejar ver el lienzo a través. El color quedaba
       * decidido y cerrado aquí.
       *
       * Ahora se expone como variable y la hoja construye la superficie con
       * ella. El registry sigue siendo la fuente del color —esto no elige
       * ninguno—; lo único que cambia es quién decide CÓMO se pinta, y esa
       * decisión es de presentación, así que pertenece al CSS.
       *
       * Sigue sin haber ni un `if` por tipo de nodo: las catorce herramientas
       * publican sus dos colores igual, y la hoja da a cada una el trato que
       * le corresponda. */
      style={
        {
          outline: selected ? `2px solid ${colors.header}` : "2px solid transparent",
          outlineOffset: "2px",
          "--flow-node-accent": colors.header,
          "--flow-node-surface": colors.body
        } as CSSProperties
      }
    >
      <Handle
        type="target"
        position={Position.Left}
        className="flow-node__handle flow-node__handle--target"
      />
      <header className="flow-node__header">
        <span className="flow-node__type-icon" aria-hidden="true">
          <Icon />
        </span>
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
      {/* La herramienta puede traer su propio cuerpo en reposo. Esta tarjeta no
          sabe cuál ni qué pinta dentro: pregunta si lo hay, igual que ya
          pregunta por el icono, y si no lo hay se queda con el resumen de una
          línea que sirve a las demás. Ningún `if` por tipo de nodo. */}
      <div className="flow-node__body">
        {CompactBody ? (
          <CompactBody
            draft={{ name: data.title, content: data.content, config: data.config }}
          />
        ) : (
          <p className="flow-node__preview">{data.preview}</p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="flow-node__handle flow-node__handle--source"
      />
    </article>
  );
}
