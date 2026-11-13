import { useId, useState } from "react";
import { DEFAULT_LABEL_COLOR, type CreateLabelRequest } from "@contracts/ContactContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { LabelColorPicker } from "@shared/labels/LabelColorPicker";

/** Nueva etiqueta: nombre y color. Una que se lee igual que otra («pagado», «Pagádo») no se deja crear. */
export function NewLabelDialog({ onCreate, onClose }: { readonly onCreate: (request: CreateLabelRequest) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_LABEL_COLOR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), color });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la etiqueta."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog lb-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (name.trim() && !busy) void submit(); }}>
        <div>
          <h2 id={titleId}>Nueva etiqueta</h2>
          <p className="ui-muted">La pones a mano en el chat o con el bloque Etiquetas de tus flujos.</p>
        </div>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={40} placeholder="VIP, Pagado, Recompra…" autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="ui-field">
          <span>Color</span>
          <LabelColorPicker value={color} onChange={setColor} />
        </div>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!name.trim() || busy}>{busy ? "Creando…" : "Crear etiqueta"}</button>
        </div>
      </form>
    </div>
  );
}
