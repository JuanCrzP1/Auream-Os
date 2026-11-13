import { useId, useState } from "react";
import type { BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { usesSummary } from "../businessDataText";
import { DatumUses } from "./DatumUses";

/**
 * Borrar un dato que usan tus mensajes los deja con un hueco: dice cuáles y
 * pide escribir su clave. Uno que nadie usa se borra con un clic.
 */
export function DeleteDatumDialog({ datum, onConfirm, onClose }: { readonly datum: BusinessDatumSummary; readonly onConfirm: (confirm: string) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const used = datum.uses.length > 0;
  const ready = !used || typed.trim() === datum.key;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(used ? datum.key : "");
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo borrar el dato."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog bd-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>¿Borrar «{datum.label}»?</h2>
        {used ? (
          <div className="bd-dialog__risk">
            <strong>Lo usan {usesSummary(datum.uses).text}</strong>
            <span>Esos mensajes saldrían sin este dato (con su valor por defecto, si tienen uno) y la regla del Condicional dejaría de cumplirse.</span>
            <DatumUses uses={datum.uses} empty="" />
          </div>
        ) : (
          <p className="ui-muted">Ningún mensaje lo usa. Se puede volver a crear cuando quieras.</p>
        )}
        {used ? (
          <label className="ui-field">
            <span>
              Escribe <code>{datum.key}</code> para confirmar
            </span>
            <input className="ui-input" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
          </label>
        ) : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--danger" disabled={!ready || busy} onClick={() => void confirm()}>{busy ? "Borrando…" : "Borrar dato"}</button>
        </div>
      </div>
    </div>
  );
}
