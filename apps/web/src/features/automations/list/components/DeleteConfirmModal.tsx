import { useRef, useEffect } from "react";
import "./modal-chrome.css";

interface DeleteConfirmModalProps {
  flowName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * DeleteConfirmModal — diálogo de confirmación antes de eliminar un flow.
 *
 * Responsabilidad única: recoger confirmación explícita del usuario.
 * No contiene lógica de negocio.
 */
export function DeleteConfirmModal({ flowName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
      <div className="modal-box">
        <h2 id="delete-modal-title" className="modal-box__title">Eliminar automatización</h2>
        <p className="modal-box__body">
          ¿Eliminar <strong>{flowName}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="modal-box__actions">
          <button type="button" className="modal-box__btn modal-box__btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmRef} type="button" className="modal-box__btn modal-box__btn--danger" onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
