import { useEffect, useRef } from "react";

interface UnsavedChangesDialogProps {
  /** Volver al editor sin perder nada. Acción primaria: no destruye. */
  readonly onKeepEditing: () => void;
  /** Salir descartando el borrador. Acción destructiva, explícita. */
  readonly onDiscard: () => void;
}

/**
 * Confirmación al intentar salir con cambios sin guardar.
 *
 * PRESENTACIONAL Y NADA MÁS. No conoce el borrador, ni la herramienta abierta,
 * ni el grafo, ni el autoguardado: recibe dos salidas y avisa de cuál ha
 * elegido el usuario. Quien decide si esta confirmación debe aparecer es
 * `NodeExpandedFrame`, que es el único que sabe si hay cambios.
 *
 * Por eso sirve para cualquier herramienta sin tocarla: no hay nada dentro que
 * dependa de qué se estaba editando.
 *
 * NO se apoya en el chrome de diálogos del Hub (`modal-chrome.css`): aquel es
 * un modal de pantalla completa de otra feature, y este vive DENTRO del marco
 * del editor —el editor sigue visible detrás, que es justo lo que hace legible
 * la decisión—. Comparte el lenguaje de acción del builder (`toolbar-button`),
 * no el del Hub.
 */
export function UnsavedChangesDialog({ onKeepEditing, onDiscard }: UnsavedChangesDialogProps) {
  const seguir = useRef<HTMLButtonElement>(null);

  // El foco entra por la salida que NO destruye. Quien confirme con Enter sin
  // leer, se queda editando: el gesto por omisión nunca puede ser el que borra.
  useEffect(() => {
    seguir.current?.focus();
  }, []);

  // Escape descarta ESTE diálogo, no el editor que hay detrás.
  //
  // El marco escucha Escape en `window` para cerrarse entero. Este manejador
  // vive en `document`, que va ANTES en el camino del evento, así que detenerlo
  // aquí impide que el mismo Escape que cierra esta confirmación se lleve por
  // delante el borrador que la confirmación existe para proteger. Es el mismo
  // patrón que ya usa el selector de unidades de Intervalo por la misma razón.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onKeepEditing();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onKeepEditing]);

  return (
    <div
      className="node-expanded__guard nodrag nowheel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-body"
    >
      <div className="node-expanded__guard-box">
        <h2 id="unsaved-changes-title" className="node-expanded__guard-title">
          No has guardado tus cambios
        </h2>
        <p id="unsaved-changes-body" className="node-expanded__guard-body">
          Si cierras ahora, perderás lo que has hecho.
        </p>
        <div className="node-expanded__guard-actions">
          {/* El orden importa: primero salir, después quedarse. La acción
              destructiva no ocupa el lugar donde el pulgar y el foco caen por
              costumbre. */}
          <button
            type="button"
            className="toolbar-button node-expanded__guard-discard"
            onClick={onDiscard}
          >
            Cerrar sin guardar
          </button>
          <button
            ref={seguir}
            type="button"
            className="toolbar-button toolbar-button--primary"
            onClick={onKeepEditing}
          >
            Seguir editando
          </button>
        </div>
      </div>
    </div>
  );
}
