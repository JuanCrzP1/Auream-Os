import "./contact-fields.css";
import { useState } from "react";
import { CONTACT_FIELD_LIMITS as LIMITS } from "@contracts/ContactFieldContracts";
import { withOption } from "./fieldTypes";

/** Las opciones de una lista: se agregan con Enter (o «Agregar») y se quitan con ×. Sin repetidas. */
export function OptionsEditor({
  options,
  onChange,
  disabled = false
}: {
  readonly options: ReadonlyArray<string>;
  readonly onChange: (options: string[]) => void;
  readonly disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const full = options.length >= LIMITS.maxOptions;

  const add = () => {
    const next = withOption(options, draft);
    if (!next) {
      setNote(draft.trim() ? `«${draft.trim()}» ya está en la lista.` : null);
      return;
    }
    onChange(next);
    setDraft("");
    setNote(null);
  };

  return (
    <div className="cf-options">
      <ul className="cf-options__list" aria-label="Opciones">
        {options.map((option) => (
          <li key={option} className="cf-option">
            {option}
            {disabled ? null : (
              <button type="button" aria-label={`Quitar ${option}`} onClick={() => onChange(options.filter((current) => current !== option))}>×</button>
            )}
          </li>
        ))}
      </ul>
      {disabled ? null : (
        <div className="cf-options__add">
          <input
            className="ui-input"
            value={draft}
            maxLength={LIMITS.maxOption}
            disabled={full}
            placeholder={full ? `Hasta ${LIMITS.maxOptions} opciones` : "Escribe una opción y pulsa Enter"}
            aria-label="Nueva opción"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              add();
            }}
          />
          <button type="button" className="ui-btn ui-btn--ghost" disabled={full || !draft.trim()} onClick={add}>Agregar</button>
        </div>
      )}
      {note ? <p className="cf-options__note" role="status">{note}</p> : null}
      {!disabled && options.length < LIMITS.minOptions ? <p className="cf-options__note">Una lista necesita al menos {LIMITS.minOptions} opciones.</p> : null}
    </div>
  );
}
