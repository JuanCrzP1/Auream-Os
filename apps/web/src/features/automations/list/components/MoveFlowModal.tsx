import "./modal-chrome.css";
import "./move-flow-modal.css";
import { useEffect, useRef } from "react";
import type { AutomationFolderSummary, AutomationSummary } from "@contracts/AutomationContracts";

interface MoveFlowModalProps {
  readonly flow: AutomationSummary;
  readonly folders: ReadonlyArray<AutomationFolderSummary>;
  readonly onConfirm: (folderId: string | null) => void;
  readonly onCancel: () => void;
}

/**
 * MoveFlowModal — elegir a qué carpeta mover una automatización, o sacarla a
 * la raíz. Es la alternativa al arrastre (accesible con teclado). Solo recoge
 * la elección: mover lo hace el hub con el mismo hook que el arrastre.
 */
export function MoveFlowModal({ flow, folders, onConfirm, onCancel }: MoveFlowModalProps) {
  const current = flow.folderId ?? null;
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const destinations: Array<{ id: string | null; name: string }> = [
    { id: null, name: "Sin carpeta" },
    ...folders.map((folder) => ({ id: folder.id, name: folder.name }))
  ];

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="move-modal-title">
      <div className="modal-box">
        <h2 id="move-modal-title" className="modal-box__title">Mover «{flow.name}»</h2>
        <ul className="move-flow__list">
          {destinations.map((destination, index) => {
            const here = destination.id === current;
            return (
              <li key={destination.id ?? "root"}>
                <button
                  ref={index === 0 ? firstRef : undefined}
                  type="button"
                  className={`move-flow__option${here ? " move-flow__option--current" : ""}`}
                  disabled={here}
                  onClick={() => onConfirm(destination.id)}
                >
                  <span className="move-flow__icon" aria-hidden="true">{destination.id === null ? "⌂" : "▤"}</span>
                  <span className="move-flow__name">{destination.name}</span>
                  {here ? <span className="move-flow__here">Está aquí</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {folders.length === 0 ? (
          <p className="move-flow__hint">Aún no tienes carpetas. Créalas desde «Nueva carpeta».</p>
        ) : null}
        <div className="modal-box__actions">
          <button type="button" className="modal-box__btn modal-box__btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
