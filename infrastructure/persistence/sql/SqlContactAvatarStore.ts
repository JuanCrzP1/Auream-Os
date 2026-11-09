import type { ContactAvatarStore } from "../../../domains/contacts/application/ContactAvatarService";
import type { SqlClient } from "./SqlClient";
import { toIso } from "./sqlValues";

/** Fotos de perfil de los contactos en Neon (`027_profile_pictures.sql`). Por cuenta; el contacto de WhatsApp se busca por teléfono. */
export class SqlContactAvatarStore implements ContactAvatarStore {
  public constructor(private readonly sql: SqlClient) {}

  public async findByPhone(tenantId: string, phone: string) {
    const row = (
      await this.sql.query<{ id: string; avatar_checked_at: Date | string | null }>(
        "select id, avatar_checked_at from contacts where tenant_id = $1 and channel = 'whatsapp' and external_key = $2",
        [tenantId, phone]
      )
    ).rows[0];
    return row ? { contactId: row.id, checkedAt: row.avatar_checked_at ? toIso(row.avatar_checked_at) : null } : null;
  }

  public async save(tenantId: string, contactId: string, avatarUrl: string | null, checkedAt: string): Promise<void> {
    await this.sql.query("update contacts set avatar_url = $3, avatar_checked_at = $4 where tenant_id = $1 and id = $2", [tenantId, contactId, avatarUrl, checkedAt]);
  }
}
