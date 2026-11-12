import type { ChatSaleLink, ChatSaleLinks } from "../../../domains/sales/application/ChatSaleLinks";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlChatSaleLinks — de un chat de la cuenta: su cliente, el número por el que
// escribe y el anuncio por el que llegó (`contacts.ad_origin.sourceId`). Una
// sola lectura, siempre filtrada por `tenant_id`.
// ---------------------------------------------------------------------------

export class SqlChatSaleLinks implements ChatSaleLinks {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(tenantId: string, conversationId: string): Promise<ChatSaleLink | null> {
    const { rows } = await this.sql.query<{ contact_id: string | null; connection_id: string; phone: string; name: string | null; ad_source_id: string | null }>(
      `select v.contact_id, v.connection_id, v.phone, ct.name, nullif(ct.ad_origin ->> 'sourceId', '') as ad_source_id
         from conversations v
         left join contacts ct on ct.tenant_id = v.tenant_id and ct.id = v.contact_id
        where v.tenant_id = $1 and v.id = $2`,
      [tenantId, conversationId]
    );
    const row = rows[0];
    if (!row) return null;
    return { contactId: row.contact_id, connectionId: row.connection_id, customerName: row.name, customerPhone: row.phone, adSourceId: row.ad_source_id };
  }
}
