import { useId, useState } from "react";
import { BUSINESS_DATA_LIMITS as LIMITS, BUSINESS_DATA_TYPES, businessKeyFromLabel, type BusinessDataType, type SaveBusinessDatumRequest } from "@contracts/BusinessDataContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TypePicker } from "@shared/contact-fields/TypePicker";
import { TYPE_HINT } from "../businessDataText";
import { ValueInput } from "./ValueInput";

/** Nuevo dato del negocio: nombre (la clave `{g_…}` sale sola), tipo, valor y para qué es. */
export function NewDatumDialog({ onCreate, onClose }: { readonly onCreate: (request: SaveBusinessDatumRequest) => Promise<unknown>; readonly onClose: () => void }) {
  const titleId = useId();
  const valueId = useId();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<BusinessDataType>("text");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = businessKeyFromLabel(label);
  const ready = key.length > 2 && label.trim().length > 0 && value.trim().length > 0;

  const changeType = (next: BusinessDataType) => {
    setType(next);
    setValue("");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ label: label.trim(), type, value, ...(description.trim() ? { description: description.trim() } : {}) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear el dato."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog bd-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void submit(); }}>
        <div>
          <h2 id={titleId}>Nuevo dato del negocio</h2>
          <p className="ui-muted">Escríbelo una vez y úsalo en todos tus mensajes. Cuando cambie, lo cambias aquí.</p>
        </div>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={label} maxLength={LIMITS.maxLabel} placeholder="Horario, dirección, link de pago…" autoFocus onChange={(e) => setLabel(e.target.value)} />
          {key ? <span className="bd-dialog__key">En tus mensajes se escribe <code>{`{${key}}`}</code></span> : null}
        </label>
        <div className="ui-field">
          <span>Tipo</span>
          <TypePicker value={type} types={BUSINESS_DATA_TYPES} onChange={changeType} />
          <span className="bd-dialog__hint">{TYPE_HINT[type]}</span>
        </div>
        <div className="ui-field">
          <span id={valueId}>Valor</span>
          <ValueInput labelId={valueId} type={type} value={value} onChange={setValue} />
        </div>
        <label className="ui-field">
          <span>Para qué es <em className="bd-dialog__optional">(opcional)</em></span>
          <input className="ui-input" value={description} maxLength={LIMITS.maxDescription} placeholder="Lo que respondemos cuando preguntan a qué hora atendemos" onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!ready || busy}>{busy ? "Creando…" : "Crear dato"}</button>
        </div>
      </form>
    </div>
  );
}
