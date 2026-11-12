// ---------------------------------------------------------------------------
// Notas internas de un cliente: lo que el equipo anota («Pagó la mitad, falta
// el resto el viernes»). Las ve el equipo en la info del chat; el cliente no.
// ---------------------------------------------------------------------------

export interface ContactNote {
  readonly id: string;
  readonly body: string;
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly createdAt: string;
  /** Quien mira la puede borrar (la escribió, o es dueño o administrador). */
  readonly canDelete: boolean;
}

export interface ContactNotesResponse {
  readonly notes: ReadonlyArray<ContactNote>;
}

export interface CreateContactNoteRequest {
  readonly body: string;
}

export const MAX_CONTACT_NOTE_LENGTH = 2000;
