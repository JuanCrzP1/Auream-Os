import "./node-expanded.css";
import "../toolbar-button.css";
import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition } from "@features/automations/builder/tools/ToolDefinition";
import type { ToolDraft, ToolUi } from "@features/automations/builder/tools/ToolUi";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

interface NodeExpandedFrameProps {
  readonly data: CanvasNode["data"];
  readonly tool: ToolDefinition;
  readonly ui: ToolUi;
  /**
   * Confirma lo editado. Se llama SOLO al pulsar «Guardar», nunca mientras se
   * escribe: es lo que separa editar de guardar.
   */
  readonly onCommit: (patch: NodePatch) => void;
  readonly onClose: () => void;
}

/**
 * Marco de configuración de un nodo abierto.
 *
 * Es TRANSVERSAL: da a todas las herramientas la misma cabecera, el mismo
 * cierre, las mismas dimensiones. Lo único que cambia entre una herramienta y
 * otra es lo que va dentro, y eso lo aporta la herramienta a través del
 * registry de UI.
 *
 * Este archivo NO conoce ninguna herramienta concreta. Si alguna vez aparece
 * aquí un `if` por tipo de nodo, la frontera se ha roto.
 *
 * NO ES UN NODO DE REACT FLOW, y por eso no lleva `Handle` propios ni
 * `useUpdateNodeInternals`: lo monta `ExpandedNodeOverlay`, flotando sobre el
 * lienzo y anclado a la posición del nodo compacto real, que es quien
 * conserva sus conexiones intactas todo el tiempo. Este componente solo pinta
 * el marco; no le importa quién lo posiciona ni cómo.
 */
export function NodeExpandedFrame({
  data,
  tool,
  ui,
  onCommit,
  onClose
}: NodeExpandedFrameProps) {
  const Editor = ui.Editor;

  // Lo que hay guardado en el nodo, ahora mismo.
  const enElNodo = useMemo<ToolDraft>(
    () => ({ name: data.title, content: data.content, config: data.config }),
    [data.title, data.content, data.config]
  );
  const firmaDelNodo = useMemo(() => JSON.stringify(enElNodo), [enElNodo]);

  // Lo que el usuario lleva editado y todavía no ha confirmado.
  const [borrador, setBorrador] = useState<ToolDraft>(enElNodo);

  // Se resincroniza cuando el nodo cambia DE VERDAD, comparando por valor y no
  // por identidad: el lienzo reconstruye objetos al seleccionar o mover, y con
  // una comparación por referencia esos gestos borrarían lo que el usuario
  // lleva escrito sin haber tocado su configuración.
  useEffect(() => {
    setBorrador(JSON.parse(firmaDelNodo) as ToolDraft);
  }, [firmaDelNodo]);

  const hayCambios = JSON.stringify(borrador) !== firmaDelNodo;

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
          dentro del marco — ya no está dentro de un nodo arrastrable, pero
          sigue estando dentro del lienzo de React Flow, que interpreta
          arrastre y rueda igual en cualquier punto que no lleve estas clases. */}
      <div className="node-expanded__body nodrag nowheel">
        {Editor ? (
          <Editor
            draft={borrador}
            onChange={(patch) => setBorrador((previo) => ({ ...previo, ...patch }))}
          />
        ) : (
          <p className="node-expanded__empty">
            Esta herramienta todavía no tiene configuración propia.
          </p>
        )}
      </div>

      {/* Barra de acciones del EDITOR, no del lienzo.
          «Guardar» confirma la configuración de esta herramienta llevándola al
          nodo; a partir de ahí el autoguardado del lienzo hace lo suyo, igual
          que con cualquier otro cambio del grafo. Son dos cosas distintas y por
          eso este botón no habla nunca de guardar el flujo.
          Vive aquí y no dentro de la herramienta porque el marco es lo único
          común a todas: cualquier editor que se declare mañana hereda esta
          barra sin escribir una línea. */}
      {Editor ? (
        <footer className="node-expanded__actions">
          <button
            type="button"
            className="toolbar-button nodrag"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="toolbar-button toolbar-button--primary nodrag"
            onClick={() => { onCommit(borrador); onClose(); }}
            // Sin cambios no hay nada que confirmar. Dejarlo pulsable sugeriría
            // que hace algo, y escribiría el nodo con lo mismo que ya tiene.
            disabled={!hayCambios}
          >
            Guardar
          </button>
        </footer>
      ) : null}
    </article>
  );
}
