import "./notes.css";
import { useState } from "react";
import { MAX_CONTACT_NOTE_LENGTH } from "@contracts/ContactNoteContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { useContactNotes } from "@shared/contacts/useContactNotes";

const WHEN = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Notas internas del cliente: lo que el equipo anota («Pagó la mitad, falta
 * el resto el viernes»). El cliente no las ve. Cada una con su autor y fecha;
 * la borra quien la escribió (o un dueño o administrador).
 */
export function NotesSection({ contactId }: { readonly contactId: string }) {
  const notes = useContactNotes(contactId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await notes.add(body);
      setDraft("");
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar la nota."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (noteId: string) => {
    setError(null);
    try {
      await notes.remove(noteId);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo borrar la nota."));
    }
  };

  return (
    <section className="ios-group chat-notes" aria-labelledby="chat-notes-title">
      <div className="ios-group__title">
        <h3 id="chat-notes-title">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l3.5 3.5v13.5H6zM14.5 3.5V7.5H18.5M9 12h6M9 15.5h6" /></svg>
          Notas internas
        </h3>
      </div>
      <form
        className="chat-notes__new"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <textarea
          value={draft}
          rows={2}
          maxLength={MAX_CONTACT_NOTE_LENGTH}
          placeholder="Anota algo para el equipo (el cliente no lo ve)…"
          aria-label="Nueva nota interna"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void add();
            }
          }}
        />
        <button type="submit" className="ios-link-btn" disabled={!draft.trim() || busy}>{busy ? "Guardando…" : "Guardar nota"}</button>
      </form>
      {error ? <p className="ios-group__hint ios-group__hint--error" role="alert">{error}</p> : null}
      {notes.status === "loading" ? <p className="ios-group__hint">Cargando notas…</p> : null}
      {notes.status === "error" ? (
        <p className="ios-group__hint">
          No se pudieron cargar las notas. <button type="button" className="ios-link-btn" onClick={() => void notes.reload()}>Reintentar</button>
        </p>
      ) : null}
      {notes.status === "ready" && notes.notes.length === 0 ? <p className="ios-group__hint">Aún no hay notas.</p> : null}
      {notes.notes.length > 0 ? (
        <ul className="chat-notes__list" aria-label="Notas">
          {notes.notes.map((note) => (
            <li key={note.id} className="chat-notes__item">
              <p>{note.body}</p>
              <span className="chat-notes__meta">
                {note.authorName ?? "Alguien del equipo"} · {WHEN.format(new Date(note.createdAt))}
                {note.canDelete ? (
                  <button type="button" className="chat-notes__delete" aria-label="Borrar nota" onClick={() => void remove(note.id)}>
                    Borrar
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
