import { builderApiClient } from "@shared/http/builderApiClient";
import type { ContactNote, ContactNotesResponse } from "@contracts/ContactNoteContracts";

// Notas internas de un cliente (`/contacts/:id/notes`).

const notes = (contactId: string) => `/contacts/${encodeURIComponent(contactId)}/notes`;

export async function fetchContactNotes(contactId: string): Promise<ReadonlyArray<ContactNote>> {
  return (await builderApiClient.get<ContactNotesResponse>(notes(contactId))).notes;
}

export function addContactNote(contactId: string, body: string): Promise<ContactNote> {
  return builderApiClient.post<ContactNote>(notes(contactId), { body });
}

export async function deleteContactNote(contactId: string, noteId: string): Promise<void> {
  await builderApiClient.delete<unknown>(`${notes(contactId)}/${encodeURIComponent(noteId)}`);
}
