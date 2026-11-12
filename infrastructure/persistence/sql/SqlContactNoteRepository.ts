import type { ContactNoteRepository, StoredContactNote } from "../../../domains/contacts/application/ContactNoteServices";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// Notas internas de los clientes (`040_chat_attention.sql`). El nombre del autor sale de su perfil actual.

interface Row {
  id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: Date | string;
}

const toNote = (row: Row): StoredContactNote => ({ id: row.id, body: row.body, authorId: row.author_id, authorName: row.author_name, createdAt: toIso(row.created_at) });

const SELECT = `select n.id, n.body, n.author_id, coalesce(u.display_name, u.email, n.author_name) as author_name, n.created_at
                  from contact_notes n left join user_profiles u on u.user_id = n.author_id`;

export class SqlContactNoteRepository implements ContactNoteRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string, contactId: string): Promise<StoredContactNote[]> {
    if (!isUuid(tenantId) || !isUuid(contactId)) return [];
    const result = await this.sql.query<Row>(`${SELECT} where n.tenant_id = $1 and n.contact_id = $2 order by n.created_at desc limit 200`, [tenantId, contactId]);
    return result.rows.map(toNote);
  }

  public async add(note: { readonly id: string; readonly tenantId: string; readonly contactId: string; readonly body: string; readonly authorId: string }): Promise<StoredContactNote | null> {
    if (!isUuid(note.tenantId) || !isUuid(note.contactId)) return null;
    // Solo si el cliente es de la cuenta (si no, no inserta nada).
    const inserted = await this.sql.query<{ id: string }>(
      `insert into contact_notes (id, tenant_id, contact_id, body, author_id)
       select $1, $2, $3, $4, $5::uuid where exists (select 1 from contacts where tenant_id = $2 and id = $3)
       returning id`,
      [note.id, note.tenantId, note.contactId, note.body, isUuid(note.authorId) ? note.authorId : null]
    );
    return inserted.rows[0] ? this.find(note.tenantId, note.contactId, note.id) : null;
  }

  public async find(tenantId: string, contactId: string, noteId: string): Promise<StoredContactNote | null> {
    if (!isUuid(tenantId) || !isUuid(contactId) || !isUuid(noteId)) return null;
    const result = await this.sql.query<Row>(`${SELECT} where n.tenant_id = $1 and n.contact_id = $2 and n.id = $3`, [tenantId, contactId, noteId]);
    return result.rows[0] ? toNote(result.rows[0]) : null;
  }

  public async remove(tenantId: string, contactId: string, noteId: string): Promise<void> {
    await this.sql.query("delete from contact_notes where tenant_id = $1 and contact_id = $2 and id = $3", [tenantId, contactId, noteId]);
  }
}
