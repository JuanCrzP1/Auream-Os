import { ContactNoteServices } from "../../../domains/contacts/application/ContactNoteServices";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlContactNoteRepository } from "../../../infrastructure/persistence/sql/SqlContactNoteRepository";

// composeContactNoteServices — las notas internas de los clientes, en PostgreSQL.
export function composeContactNoteServices(sql: SqlClient): ContactNoteServices {
  return new ContactNoteServices(new SqlContactNoteRepository(sql));
}
