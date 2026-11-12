import { randomUUID } from "node:crypto";
import { MAX_CONTACT_NOTE_LENGTH, type ContactNote } from "../../../contracts/ContactNoteContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Notas internas de un cliente: lo que anota el equipo. Las borra quien la
// escribió, o un dueño o administrador. Todo filtra por cuenta.
// ---------------------------------------------------------------------------

export interface StoredContactNote {
  readonly id: string;
  readonly body: string;
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly createdAt: string;
}

export interface ContactNoteRepository {
  /** Las del cliente, de la más nueva a la más vieja. */
  list(tenantId: string, contactId: string): Promise<StoredContactNote[]>;
  /** `null` si el cliente no es de esa cuenta. */
  add(note: { readonly id: string; readonly tenantId: string; readonly contactId: string; readonly body: string; readonly authorId: string }): Promise<StoredContactNote | null>;
  find(tenantId: string, contactId: string, noteId: string): Promise<StoredContactNote | null>;
  remove(tenantId: string, contactId: string, noteId: string): Promise<void>;
}

/** Quien mira: para saber qué notas puede borrar. */
export interface NoteViewer {
  readonly userId: string;
  readonly canManage: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ContactNoteServices {
  public constructor(private readonly repository: ContactNoteRepository) {}

  public async list(tenantId: string, contactId: string, viewer: NoteViewer): Promise<ContactNote[]> {
    if (!UUID.test(contactId)) return [];
    return (await this.repository.list(tenantId, contactId)).map((note) => this.view(note, viewer));
  }

  public async add(tenantId: string, contactId: string, body: unknown, viewer: NoteViewer): Promise<ContactNote> {
    const text = typeof body === "string" ? body.trim() : "";
    if (!text) throw new ValidationError("Escribe la nota.");
    if (text.length > MAX_CONTACT_NOTE_LENGTH) throw new ValidationError(`La nota admite hasta ${MAX_CONTACT_NOTE_LENGTH} caracteres.`);
    const saved = UUID.test(contactId) ? await this.repository.add({ id: randomUUID(), tenantId, contactId, body: text, authorId: viewer.userId }) : null;
    if (!saved) throw new NotFoundError("Ese cliente no existe.");
    return this.view(saved, viewer);
  }

  public async remove(tenantId: string, contactId: string, noteId: string, viewer: NoteViewer): Promise<void> {
    const note = UUID.test(contactId) && UUID.test(noteId) ? await this.repository.find(tenantId, contactId, noteId) : null;
    if (!note) throw new NotFoundError("Esa nota ya no existe.");
    if (!this.view(note, viewer).canDelete) throw new ValidationError("Solo quien escribió la nota, o un dueño o administrador, la puede borrar.");
    await this.repository.remove(tenantId, contactId, noteId);
  }

  private view(note: StoredContactNote, viewer: NoteViewer): ContactNote {
    return { ...note, canDelete: viewer.canManage || note.authorId === viewer.userId };
  }
}
