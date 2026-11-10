import "./follow-ups.css";
import { useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { quickDueOptions } from "../crmFormat";

/** `YYYY-MM-DDTHH:mm` en la hora del navegador (para `datetime-local`). */
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Un seguimiento nuevo: qué hacer y cuándo, con atajos («Mañana 9:00 a. m.»). */
export function FollowUpComposer({ onCreate }: { readonly onCreate: (title: string, dueAt: string) => Promise<void> }) {
  const options = quickDueOptions();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(localInput(options[1]!.at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="follow-up-composer"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await onCreate(title, new Date(due).toISOString());
          setTitle("");
        } catch (e) {
          setError(apiErrorMessage(e, "No se pudo guardar el seguimiento."));
        }
        setBusy(false);
      }}
    >
      <label className="ui-field">
        <span>Nuevo seguimiento</span>
        <input className="ui-input" value={title} maxLength={140} placeholder="Ej.: llamar para cerrar" onChange={(event) => setTitle(event.target.value)} />
      </label>
      <div className="follow-up-composer__chips" role="group" aria-label="Cuándo">
        {options.map((option) => (
          <button key={option.label} type="button" aria-pressed={localInput(option.at) === due} className="follow-up-composer__chip" onClick={() => setDue(localInput(option.at))}>
            {option.label}
          </button>
        ))}
        <input type="datetime-local" className="ui-input follow-up-composer__date" aria-label="Elegir fecha y hora" value={due} onChange={(event) => setDue(event.target.value)} />
      </div>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      <button type="submit" className="ui-btn ui-btn--primary follow-up-composer__save" disabled={busy || !title.trim() || !due}>
        {busy ? "Guardando…" : "Agregar"}
      </button>
    </form>
  );
}
