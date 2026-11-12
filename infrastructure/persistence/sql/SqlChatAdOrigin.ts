import { readAdOrigin } from "../../../contracts/AdOrigin";
import type { ChatAdLookup, ChatAdOriginReader } from "../../../domains/conversations/application/ChatAdOriginService";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlChatAdOrigin — el anuncio del cliente de un chat (`contacts.ad_origin`) y,
// si es de una cuenta de Meta conectada de la MISMA cuenta (sincronizado en
// `ad_entities`, la misma regla que «por anuncio» en el Dashboard), su nombre,
// estado, miniatura y el nombre de su campaña. Una lectura.
// ---------------------------------------------------------------------------

interface Row {
  ad_origin: unknown;
  ad_name: string | null;
  ad_status: string | null;
  ad_thumbnail: string | null;
  campaign_name: string | null;
}

export class SqlChatAdOrigin implements ChatAdOriginReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(tenantId: string, conversationId: string): Promise<ChatAdLookup | null> {
    const { rows } = await this.sql.query<Row>(
      `select ct.ad_origin, ad.name as ad_name, ad.status as ad_status, ad.thumbnail_url as ad_thumbnail, camp.name as campaign_name
         from conversations v
         left join contacts ct on ct.tenant_id = v.tenant_id and ct.id = v.contact_id
         left join lateral (select e.name, e.status, e.thumbnail_url, e.campaign_id from ad_entities e
                            where e.tenant_id = v.tenant_id and e.level = 'ad' and e.external_id = ct.ad_origin ->> 'sourceId' limit 1) ad on true
         left join lateral (select name from ad_entities where tenant_id = v.tenant_id and level = 'campaign' and external_id = ad.campaign_id limit 1) camp on true
        where v.tenant_id = $1 and v.id = $2`,
      [tenantId, conversationId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      origin: readAdOrigin(row.ad_origin),
      known: row.ad_name ? { name: row.ad_name, campaignName: row.campaign_name, status: row.ad_status, thumbnailUrl: row.ad_thumbnail } : null
    };
  }
}
