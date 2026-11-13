import type { AudienceFilter } from "../../../contracts/BroadcastContracts";
import type { AudienceSource, Candidate, OptOutStore } from "../../../domains/broadcasts/application/BroadcastPorts";
import { fieldFilterSql } from "./fieldFilterSql";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlBroadcastAudience — a quién le puede llegar una difusión: SOLO a quien
// ya escribió por alguno de esos números (`conversation_messages` entrantes).
// Un cliente aparece una vez: por el número en que habló más reciente.
// Las etapas del CRM son etiquetas, así que el filtro por etiqueta las cubre.
// También guarda quién pidió no recibir más (`broadcast_opt_outs`).
// ---------------------------------------------------------------------------

interface Row {
  readonly contact_id: string | null;
  readonly name: string | null;
  readonly phone: string;
  readonly connection_id: string;
  readonly opted_out: boolean;
}

const toCandidate = (row: Omit<Row, "opted_out">): Candidate => ({ contactId: row.contact_id, name: row.name, phone: row.phone, connectionId: row.connection_id });

export class SqlBroadcastAudience implements AudienceSource, OptOutStore {
  public constructor(private readonly sql: SqlClient) {}

  public async resolve(tenantId: string, audience: AudienceFilter, connectionIds: ReadonlyArray<string>, limit: number) {
    const params: unknown[] = [tenantId, connectionIds, audience.lastInboundDays, audience.labelIds, audience.excludeLabelIds, audience.excludeBoughtDays, limit];
    // Por Campos del cliente: sobre la ficha del contacto del chat (un chat sin contacto no cumple ninguno).
    const byFields = fieldFilterSql(audience.fields ?? [], "ct.custom_fields", params).map((condition) => `\n            and ${condition}`).join("");
    const result = await this.sql.query<Row>(
      `with chats as (
         select distinct on (coalesce(c.contact_id::text, c.phone))
                c.contact_id, ct.name, c.phone, c.connection_id, li.last_in
           from conversations c
           join whatsapp_connections w on w.tenant_id = c.tenant_id and w.id = c.connection_id and w.deleted_at is null
           left join contacts ct on ct.tenant_id = c.tenant_id and ct.id = c.contact_id
           cross join lateral (select max(m.created_at) as last_in from conversation_messages m
                                where m.conversation_id = c.id and m.direction = 'inbound') li
          where c.tenant_id = $1 and c.connection_id = any($2::uuid[]) and li.last_in is not null
            and ($3::int is null or li.last_in >= now() - make_interval(days => $3::int))
            and (cardinality($4::uuid[]) = 0 or exists (select 1 from contact_label_assignments a
                  where a.tenant_id = c.tenant_id and a.contact_id = c.contact_id and a.label_id = any($4::uuid[])))
            and not exists (select 1 from contact_label_assignments a
                  where a.tenant_id = c.tenant_id and a.contact_id = c.contact_id and a.label_id = any($5::uuid[]))
            and ($6::int is null or not exists (select 1 from sales s
                  where s.tenant_id = c.tenant_id and s.contact_id = c.contact_id and s.status = 'approved'
                    and s.sold_at >= now() - make_interval(days => $6::int)))${byFields}
          order by coalesce(c.contact_id::text, c.phone), li.last_in desc
       )
       select ch.contact_id, ch.name, ch.phone, ch.connection_id,
              exists (select 1 from broadcast_opt_outs o where o.tenant_id = $1 and o.phone = ch.phone) as opted_out
         from chats ch
        order by ch.last_in desc
        limit $7`,
      params
    );
    return {
      candidates: result.rows.filter((row) => !row.opted_out).map(toCandidate),
      optedOut: result.rows.filter((row) => row.opted_out).length
    };
  }

  public async nonResponders(tenantId: string, broadcastId: string, limit: number): Promise<ReadonlyArray<Candidate>> {
    const result = await this.sql.query<Omit<Row, "opted_out">>(
      `select r.contact_id, r.name, r.phone, r.connection_id
         from broadcast_recipients r
         join conversations c on c.tenant_id = r.tenant_id and c.connection_id = r.connection_id and c.phone = r.phone
        where r.tenant_id = $1 and r.broadcast_id = $2 and r.status = 'sent'
          and not exists (select 1 from conversation_messages m where m.conversation_id = c.id and m.direction = 'inbound' and m.created_at > r.sent_at)
          and not exists (select 1 from broadcast_opt_outs o where o.tenant_id = r.tenant_id and o.phone = r.phone)
          and not exists (select 1 from sales s where s.tenant_id = r.tenant_id and s.contact_id = r.contact_id and s.status = 'approved' and s.sold_at >= r.sent_at)
        order by r.position
        limit $3`,
      [tenantId, broadcastId, limit]
    );
    return result.rows.map(toCandidate);
  }

  public async add(tenantId: string, phone: string, at: Date): Promise<void> {
    await this.sql.query("insert into broadcast_opt_outs (tenant_id, phone, created_at) values ($1, $2, $3) on conflict do nothing", [tenantId, phone, at]);
  }

  public async has(tenantId: string, phone: string): Promise<boolean> {
    const result = await this.sql.query("select 1 from broadcast_opt_outs where tenant_id = $1 and phone = $2", [tenantId, phone]);
    return result.rows.length > 0;
  }
}
