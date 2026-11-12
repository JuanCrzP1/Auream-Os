import { useCallback, useEffect, useState } from "react";
import type { ContactNote } from "@contracts/ContactNoteContracts";
import { addContactNote, deleteContactNote, fetchContactNotes } from "./contactNotesApi";

/** Las notas internas de un cliente: cargar, anotar y borrar. */
export function useContactNotes(contactId: string | null) {
  const [notes, setNotes] = useState<ReadonlyArray<ContactNote>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    if (!contactId) return;
    setStatus("loading");
    try {
      setNotes(await fetchContactNotes(contactId));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async (body: string) => {
    if (!contactId) return;
    const note = await addContactNote(contactId, body);
    setNotes((current) => [note, ...current]);
  }, [contactId]);

  const remove = useCallback(async (noteId: string) => {
    if (!contactId) return;
    await deleteContactNote(contactId, noteId);
    setNotes((current) => current.filter((note) => note.id !== noteId));
  }, [contactId]);

  return { notes, status, reload: load, add, remove };
}
