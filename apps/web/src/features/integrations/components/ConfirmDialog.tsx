import { useId, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/** Confirmación de una acción destructiva. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose
}: {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo completar. Inténtalo de nuevo."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>{title}</h2>
        <p className="ui-muted">{message}</p>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--danger" onClick={() => void confirm()} disabled={busy}>
            {busy ? "Eliminando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
