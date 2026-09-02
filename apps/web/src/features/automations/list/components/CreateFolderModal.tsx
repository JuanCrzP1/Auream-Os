import { useRef, useEffect, useState } from "react";
import "./modal-chrome.css";

interface CreateFolderModalProps {
  busy?: boolean;
  error?: string | null;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/**
 * CreateFolderModal — diálogo para crear una carpeta.
 *
 * Responsabilidad única: recoger y validar el nombre.
 * No crea nada: quien decide qué hacer con el nombre es useCreateFolder.
 *
 * Enter confirma (submit del formulario) y Escape cancela desde cualquier
 * punto del foco, incluido el propio input.
 */
export function CreateFolderModal({
  busy = false,
  error = null,
  onConfirm,
  onCancel
}: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0 || busy) return;
    onConfirm(trimmed);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="create-folder-modal-title">
      <div className="modal-box">
        <h2 id="create-folder-modal-title" className="modal-box__title">Nueva carpeta</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            ref={inputRef}
            type="text"
            className="modal-form__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Nombre de la carpeta"
            aria-label="Nombre de la carpeta"
            autoComplete="off"
            disabled={busy}
          />
          {error && (
            <p className="modal-form__error" role="alert">{error}</p>
          )}
          <div className="modal-box__actions">
            <button
              type="button"
              className="modal-box__btn modal-box__btn--ghost"
              onClick={onCancel}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="modal-box__btn modal-box__btn--primary"
              disabled={trimmed.length === 0 || busy}
            >
              {busy ? "Creando..." : "Crear carpeta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
