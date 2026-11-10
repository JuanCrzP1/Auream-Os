import "./email-chips.css";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SEPARATORS = /[\s,;]+/;

export const isEmail = (value: string) => EMAIL.test(value.trim());

/**
 * Correos como chips: se escriben y se cierran con Enter, coma o espacio; se
 * pegan varios de una vez; Retroceso con el campo vacío quita el último. Los
 * que no parecen correo se marcan en rojo (el servidor vuelve a revisar).
 */
export function EmailChipsInput({
  id,
  emails,
  onChange,
  max = 20
}: {
  readonly id: string;
  readonly emails: ReadonlyArray<string>;
  readonly onChange: (emails: ReadonlyArray<string>) => void;
  readonly max?: number;
}) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const incoming = raw.split(SEPARATORS).map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (incoming.length === 0) return;
    const next = [...emails];
    for (const email of incoming) if (!next.includes(email) && next.length < max) next.push(email);
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", ";"].includes(event.key) && draft.trim()) {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    add(`${draft} ${event.clipboardData.getData("text")}`);
  };

  return (
    <div className="email-chips" onClick={() => document.getElementById(id)?.focus()}>
      {emails.map((email) => (
        <span key={email} className={`email-chips__chip${isEmail(email) ? "" : " email-chips__chip--bad"}`}>
          {email}
          <button type="button" className="email-chips__remove" aria-label={`Quitar ${email}`} onClick={() => onChange(emails.filter((value) => value !== email))}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        className="email-chips__input"
        type="email"
        autoFocus
        value={draft}
        placeholder={emails.length === 0 ? "ana@tuempresa.com, luis@tuempresa.com" : ""}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => add(draft)}
      />
    </div>
  );
}
