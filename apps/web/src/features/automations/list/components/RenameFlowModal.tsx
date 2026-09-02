import { useRef, useEffect, useState } from "react";
import "./modal-chrome.css";

interface RenameFlowModalProps {
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

/**
 * RenameFlowModal — diálogo para renombrar un flow.
 *
 * Responsabilidad única: recoger el nuevo nombre del usuario.
 * No contiene lógica de negocio.
 */
export function RenameFlowModal({ currentName, onConfirm, onCancel }: RenameFlowModalProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) onConfirm(trimmed);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rename-modal-title">
      <div className="modal-box">
        <h2 id="rename-modal-title" className="modal-box__title">Renombrar automatización</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            ref={inputRef}
            type="text"
            className="modal-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            aria-label="Nuevo nombre"
            autoComplete="off"
          />
          <div className="modal-box__actions">
            <button type="button" className="modal-box__btn modal-box__btn--ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="modal-box__btn modal-box__btn--primary" disabled={name.trim().length === 0}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
