import "./node-expanded.css";
import "../toolbar-button.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToolDefinition } from "@features/automations/builder/tools/ToolDefinition";
import type { ToolDraft, ToolUi } from "@features/automations/builder/tools/ToolUi";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

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

  /**
   * ¿Puede guardarse lo que hay?
   *
   * La respuesta la da la HERRAMIENTA, no este marco: aquí no se sabe qué es un
   * bloque de contenido ni qué hace válida una imagen. Se pregunta igual que ya
   * se pregunta por el icono o por el editor, y una herramienta que no declare
   * nada se guarda siempre — que es el caso de las trece restantes.
   */
  const validez = tool.validateContent?.(borrador.content, borrador.config) ?? {
    valido: true,
    motivo: null
  };

  // El aviso aparece cuando el usuario INTENTA guardar, no mientras construye:
  // señalar un mensaje incompleto desde el primer clic sería regañarle por no
  // haber terminado todavía. Se retira solo en cuanto lo que hay ya vale.
  const [intentoRechazado, setIntentoRechazado] = useState(false);
  const avisoDeValidez = intentoRechazado && !validez.valido ? validez.motivo : null;

  // Salir con cambios pendientes se pregunta; salir sin ellos, no.
  //
  // Vive AQUÍ y no en cada herramienta porque aquí es donde está el borrador:
  // el marco es el único que sabe si queda algo sin confirmar. Cualquier
  // herramienta que declare editor hereda esta protección sin escribir nada,
  // igual que hereda la barra de «Cancelar» y «Guardar».
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const cerrar = useRef<HTMLButtonElement>(null);

  /**
   * INTENTO de salir: la X y Escape.
   *
   * Distinto de «Cancelar», que es una decisión ya tomada de descartar, y por
   * eso no pregunta. Un aspa no significa «tira lo que llevo hecho»: significa
   * «quiero salir», y con trabajo sin guardar por medio esas dos cosas no
   * pueden resolverse igual.
   */
  const intentarCerrar = useCallback(() => {
    // Red de seguridad: con la confirmación ya abierta, un segundo intento no
    // puede cerrar el editor por detrás de ella.
    if (confirmandoSalida) return;
    if (hayCambios) {
      setConfirmandoSalida(true);
      return;
    }

    onClose();
  }, [confirmandoSalida, hayCambios, onClose]);

  /** Volver al editor. El borrador no se toca: sigue exactamente donde estaba. */
  const seguirEditando = useCallback(() => {
    setConfirmandoSalida(false);
    // El foco vuelve de donde salió. Sin esto quedaría en el cuerpo del
    // documento y quien navegue con teclado tendría que rehacer el camino.
    cerrar.current?.focus();
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
      if (event.key === "Escape") intentarCerrar();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [intentarCerrar]);

  return (
    <article className="node-expanded" style={{ borderColor: tool.colors.header }}>
      <header className="node-expanded__header" style={{ background: tool.colors.header }}>
        <span className="node-expanded__icon" aria-hidden="true">
          <ui.Icon />
        </span>
        <span className="node-expanded__title">{data.title}</span>
        <button
          ref={cerrar}
          type="button"
          className="node-expanded__close nodrag"
          onClick={intentarCerrar}
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
          {avisoDeValidez ? (
            <p className="node-expanded__aviso" role="alert">
              {avisoDeValidez}
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
              if (!validez.valido) {
                setIntentoRechazado(true);
                return;
              }

              setIntentoRechazado(false);
              onCommit(borrador);
              onClose();
            }}
            // Sin cambios no hay nada que confirmar. Dejarlo pulsable sugeriría
            // que hace algo, y escribiría el nodo con lo mismo que ya tiene.
            disabled={!hayCambios}
          >
            Guardar
          </button>
        </footer>
      ) : null}

      {/* Dentro del marco a propósito: el editor sigue viéndose detrás, así que
          la decisión se toma con lo que está en juego a la vista. Un modal de
          pantalla completa habría tapado justo aquello por lo que se pregunta. */}
      {confirmandoSalida ? (
        <UnsavedChangesDialog onKeepEditing={seguirEditando} onDiscard={onClose} />
      ) : null}
    </article>
  );
}
