import "./contact-fields.css";
import { useId, useState } from "react";
import { CONTACT_FIELD_LIMITS as LIMITS, keyFromLabel, RESERVED_FIELD_KEYS, type ContactFieldType, type SaveContactFieldRequest } from "@contracts/ContactFieldContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TYPE_HINT } from "./fieldTypes";
import { OptionsEditor } from "./OptionsEditor";
import { TypePicker } from "./TypePicker";

/** Un fallo ya explicado para la persona (p. ej. el mensaje que devolvió una capacidad del editor). */
export class FieldCreateFailed extends Error {}

/**
 * Nuevo campo: nombre (la clave sale sola), tipo y, si es lista, sus opciones.
 * `fixedKey`: convertir en campo un dato que ya se guarda con esa clave (los
 * flujos siguen igual). `initialLabel`: el nombre que ya se escribió (p. ej.
 * en el buscador del editor).
 */
export function NewFieldDialog({
  onCreate,
  onClose,
  initialLabel = "",
  fixedKey
}: {
  readonly onCreate: (request: SaveContactFieldRequest) => Promise<unknown>;
  readonly onClose: () => void;
  readonly initialLabel?: string;
  readonly fixedKey?: string;
}) {
  const titleId = useId();
  const [label, setLabel] = useState(initialLabel);
  const [type, setType] = useState<ContactFieldType>("text");
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = fixedKey ?? keyFromLabel(label);
  const reserved = !fixedKey && RESERVED_FIELD_KEYS.has(key);
  const ready = key.length > 0 && label.trim().length > 0 && !reserved && (type !== "list" || options.length >= LIMITS.minOptions);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onCreate({ label: label.trim(), type, ...(fixedKey ? { key: fixedKey } : {}), ...(type === "list" ? { options } : {}) });
      onClose();
    } catch (e) {
      setError(e instanceof FieldCreateFailed ? e.message : apiErrorMessage(e, "No se pudo crear el campo."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <form className="ui-dialog cf-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (ready && !busy) void submit(); }}>
        <div>
          <h2 id={titleId}>{fixedKey ? "Convertir en campo" : "Nuevo campo"}</h2>
          <p className="ui-muted">{fixedKey ? "Tus flujos lo siguen guardando igual; gana nombre, tipo y lugar en la ficha." : "Un dato que quieres guardar de cada cliente."}</p>
        </div>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={label} maxLength={LIMITS.maxLabel} placeholder="Ciudad, presupuesto, cumpleaños…" autoFocus onChange={(e) => setLabel(e.target.value)} />
          {key ? (
            <span className={`cf-dialog__key${reserved ? " is-error" : ""}`}>
              {reserved ? <>«{`{${key}}`}» ya lo llena Auream: elige otro nombre.</> : fixedKey ? <>Se sigue usando como <code>{`{${key}}`}</code></> : <>En tus mensajes se escribe <code>{`{${key}}`}</code></>}
            </span>
          ) : null}
        </label>
        <div className="ui-field">
          <span>Tipo</span>
          <TypePicker value={type} onChange={setType} />
          <span className="cf-dialog__hint">{TYPE_HINT[type]}</span>
        </div>
        {type === "list" ? (
          <div className="ui-field">
            <span>Opciones</span>
            <OptionsEditor options={options} onChange={setOptions} />
          </div>
        ) : null}
        <p className="cf-dialog__foot">Lo podrás guardar desde Esperar respuesta, Menú, Integración o IA, verlo en la ficha del cliente y usarlo en mensajes y condiciones.</p>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={!ready || busy}>{busy ? "Creando…" : fixedKey ? "Convertir en campo" : "Crear campo"}</button>
        </div>
      </form>
    </div>
  );
}
