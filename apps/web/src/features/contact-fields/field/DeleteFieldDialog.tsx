import "./field-dialogs.css";
import { useId, useState } from "react";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { clients } from "../fieldText";
import { FieldUses } from "./FieldUses";

/**
 * Borrar un campo se lleva su dato de todos los clientes y no se recupera.
 * Si tiene datos o bloques que lo usan, hay que escribir su clave.
 */
export function DeleteFieldDialog({ field, onConfirm, onClose }: { readonly field: ContactFieldSummary; readonly onConfirm: (confirm: string) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guarded = field.filled > 0 || field.uses.length > 0;
  const ready = !guarded || typed.trim() === field.key;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(field.key);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo borrar el campo."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog cf-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>¿Borrar «{field.label}»?</h2>
        <p className="ui-muted">
          {field.filled > 0 ? `${clients(field.filled)} ${field.filled === 1 ? "tiene" : "tienen"} este dato. Si lo borras, se pierde y no se puede recuperar.` : "Ningún cliente tiene este dato todavía."}
        </p>
        {field.uses.length > 0 ? (
          <div className="cf-dialog__risk">
            <strong>Estos bloques lo usan</strong>
            <span className="cf-dialog__risk-note">Seguirán funcionando en la conversación, pero lo que guarden ya no quedará en la ficha del cliente.</span>
            <FieldUses uses={field.uses} empty="" verb />
          </div>
        ) : null}
        {guarded ? (
          <label className="ui-field">
            <span>
              Escribe <code>{field.key}</code> para confirmar
            </span>
            <input className="ui-input" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
          </label>
        ) : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--danger" disabled={!ready || busy} onClick={() => void confirm()}>
            {busy ? "Borrando…" : field.filled > 0 ? "Borrar campo y datos" : "Borrar campo"}
          </button>
        </div>
      </div>
    </div>
  );
}
