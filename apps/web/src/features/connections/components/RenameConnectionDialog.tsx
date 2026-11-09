import { useId, useState } from "react";
import { MAX_CONNECTION_NAME } from "@contracts/ConnectionContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/** Cambiar el nombre con que el equipo reconoce un número. */
export function RenameConnectionDialog({
  name,
  onSave,
  onClose
}: {
  readonly name: string;
  readonly onSave: (name: string) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo cambiar el nombre. Inténtalo de nuevo."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>Renombrar conexión</h2>
        <div className="ui-field">
          <label htmlFor={inputId}>Nombre</label>
          <input
            id={inputId}
            className="ui-input"
            value={value}
            maxLength={MAX_CONNECTION_NAME}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim()) void save();
            }}
          />
        </div>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={busy || !value.trim() || value.trim() === name}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
