import "./node-expanded.css";
import "../toolbar-button.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { VALID, type ToolDefinition } from "@features/automations/builder/tools/ToolDefinition";
import type { ToolDraft, ToolUi } from "@features/automations/builder/tools/ToolUi";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import { useBuilderResources } from "@features/automations/builder/context/BuilderResourcesContext";
import { useBuilderReadOnly } from "@features/automations/builder/context/BuilderEditingContext";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { NodeReadOnlyBody } from "./NodeReadOnly";

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
  const resources = useBuilderResources();
  // Solo lectura (sin `flows.write`): se ve la configuración, no se cambia ni se guarda.
  const readOnly = useBuilderReadOnly();

  // Lo que hay guardado en el nodo, ahora mismo.
  const saved = useMemo<ToolDraft>(
    () => ({ name: data.title, content: data.content, config: data.config }),
    [data.title, data.content, data.config]
  );
  const savedSignature = useMemo(() => JSON.stringify(saved), [saved]);

  // Lo que el usuario lleva editado y todavía no ha confirmado.
  const [draft, setDraft] = useState<ToolDraft>(saved);

  // Se resincroniza cuando el nodo cambia DE VERDAD, comparando por valor y no
  // por identidad: el lienzo reconstruye objetos al seleccionar o mover, y con
  // una comparación por referencia esos gestos borrarían lo que el usuario
  // lleva escrito sin haber tocado su configuración.
  useEffect(() => {
    setDraft(JSON.parse(savedSignature) as ToolDraft);
  }, [savedSignature]);

  const isDirty = JSON.stringify(draft) !== savedSignature;

  /**
   * ¿Puede guardarse lo que hay?
   *
   * La respuesta la da la HERRAMIENTA, no este marco: aquí no se sabe qué es un
   * bloque de contenido ni qué hace válida una imagen. Se pregunta igual que ya
   * se pregunta por el icono o por el editor; sin `validate`, se guarda siempre.
   */
  const validation = tool.validate?.(draft.content, draft.config) ?? VALID;

  // El aviso aparece cuando el usuario INTENTA guardar, no mientras construye:
  // señalar un mensaje incompleto desde el primer clic sería regañarle por no
  // haber terminado todavía. Se retira solo en cuanto lo que hay ya vale.
  const [rejectedAttempt, setRejectedAttempt] = useState(false);
  const validationNotice = rejectedAttempt && !validation.valid ? validation.reason : null;

  // Salir con cambios pendientes se pregunta; salir sin ellos, no.
  //
  // Vive AQUÍ y no en cada herramienta porque aquí es donde está el borrador:
  // el marco es el único que sabe si queda algo sin confirmar. Cualquier
  // herramienta que declare editor hereda esta protección sin escribir nada,
  // igual que hereda la barra de «Cancelar» y «Guardar».
  const [confirmingExit, setConfirmingExit] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  /**
   * INTENTO de salir: la X y Escape.
   *
   * Distinto de «Cancelar», que es una decisión ya tomada de descartar, y por
   * eso no pregunta. Un aspa no significa «tira lo que llevo hecho»: significa
   * «quiero salir», y con trabajo sin guardar por medio esas dos cosas no
   * pueden resolverse igual.
   */
  const requestClose = useCallback(() => {
    // Red de seguridad: con la confirmación ya abierta, un segundo intento no
    // puede cerrar el editor por detrás de ella.
    if (confirmingExit) return;
    if (isDirty) {
      setConfirmingExit(true);
      return;
    }

    onClose();
  }, [confirmingExit, isDirty, onClose]);

  /** Volver al editor. El borrador no se toca: sigue exactamente donde estaba. */
  const keepEditing = useCallback(() => {
    setConfirmingExit(false);
    // El foco vuelve de donde salió. Sin esto quedaría en el cuerpo del
    // documento y quien navegue con teclado tendría que rehacer el camino.
    closeButtonRef.current?.focus();
  }, []);

  // Escape cierra. Es la salida que se espera de cualquier cosa que se abre, y
  // la única que no exige apuntar con el ratón. Pasa por la misma guarda que la
  // X: son el mismo gesto por dos caminos distintos.
  //
  // Con la confirmación abierta este manejador no llega a verlo — el diálogo
  // detiene el Escape en `document`, antes de `window` —, y si alguna vez
  // llegara, `intentarCerrar` ya no haría nada.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return (
    // Es una ventana de edición encima del lienzo: los lectores de pantalla la
    // anuncian como diálogo, con el nombre del bloque.
    <article
      className="node-expanded"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ borderColor: tool.colors.header }}
    >
      <header className="node-expanded__header" style={{ background: tool.colors.header }}>
        <span className="node-expanded__icon" aria-hidden="true">
          <ui.Icon />
        </span>
        <span id={titleId} className="node-expanded__title">
          {data.title}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          className="node-expanded__close nodrag"
          onClick={requestClose}
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
        {Editor && readOnly ? (
          <NodeReadOnlyBody Editor={Editor} draft={draft} resources={resources} />
        ) : Editor ? (
          <Editor
            draft={draft}
            resources={resources}
            onChange={(patch) => setDraft((previous) => ({ ...previous, ...patch }))}
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
      {Editor && readOnly ? (
        <footer className="node-expanded__actions">
          <button type="button" className="toolbar-button nodrag" onClick={onClose}>Cerrar</button>
        </footer>
      ) : Editor ? (
        <footer className="node-expanded__actions">
          {validationNotice ? (
            <p className="node-expanded__aviso" role="alert">
              {validationNotice}
            </p>
          ) : null}
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
            onClick={() => {
              // Inválido: ni se confirma, ni se cierra. Solo se dice por qué.
              if (!validation.valid) {
                setRejectedAttempt(true);
                return;
              }

              setRejectedAttempt(false);
              onCommit(draft);
              onClose();
            }}
            // Sin cambios no hay nada que confirmar. Dejarlo pulsable sugeriría
            // que hace algo, y escribiría el nodo con lo mismo que ya tiene.
            disabled={!isDirty}
          >
            Guardar
          </button>
        </footer>
      ) : null}

      {/* Dentro del marco a propósito: el editor sigue viéndose detrás, así que
          la decisión se toma con lo que está en juego a la vista. Un modal de
          pantalla completa habría tapado justo aquello por lo que se pregunta. */}
      {confirmingExit ? (
        <UnsavedChangesDialog onKeepEditing={keepEditing} onDiscard={onClose} />
      ) : null}
    </article>
  );
}
