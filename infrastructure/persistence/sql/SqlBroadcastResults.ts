import { BROADCAST_LIMITS } from "../../../contracts/BroadcastContracts";
import type { BroadcastStats, MoneyAmount, RecipientFilter, RecipientState, RecipientsPage, VariantResult } from "../../../contracts/BroadcastResultsContracts";
import { mergeMoney, type BroadcastResults } from "../../../domains/broadcasts/application/BroadcastPorts";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlBroadcastResults — del envío a la venta, leído de donde vive cada dato
// (nada se copia, así siempre está al día):
//   · entregado y leído: el aviso de WhatsApp del primer mensaje (bandeja)
//   · respondió: un mensaje del cliente en ese chat después del envío
//   · compró: una venta aprobada de ese cliente dentro de los 3 días, y la
//     difusión es la ÚLTIMA que recibió antes de comprar (no se cuenta doble)
// ---------------------------------------------------------------------------

/** Ventas que cuentan para el destinatario `r` (último contacto antes de comprar). */
const attributed = (r: string) => `select s.amount, s.currency from sales s
   where s.tenant_id = ${r}.tenant_id and s.contact_id = ${r}.contact_id and s.status = 'approved'
     and s.sold_at >= ${r}.sent_at and s.sold_at < ${r}.sent_at + make_interval(days => ${BROADCAST_LIMITS.attributionDays})
     and not exists (select 1 from broadcast_recipients r2 where r2.tenant_id = ${r}.tenant_id and r2.contact_id = ${r}.contact_id
                      and r2.status = 'sent' and r2.sent_at > ${r}.sent_at and r2.sent_at <= s.sold_at)`;

/** Cada destinatario con su estado completo (`$1` cuenta, `$2` difusiones). */
const FACTS = `with base as (
    select r.*, c.id as conversation_id
      from broadcast_recipients r
      left join conversations c on c.tenant_id = r.tenant_id and c.connection_id = r.connection_id and c.phone = r.phone
     where r.tenant_id = $1 and r.broadcast_id = any($2::uuid[])
  ), facts as (
    select b.*, m.status as message_status,
           (b.status = 'sent' and exists (select 1 from conversation_messages i where i.conversation_id = b.conversation_id
                                           and i.direction = 'inbound' and i.created_at > b.sent_at)) as replied,
           (b.status = 'sent' and exists (select 1 from broadcast_opt_outs o where o.tenant_id = b.tenant_id and o.phone = b.phone and o.created_at > b.sent_at)) as left_after,
           (b.status = 'sent' and b.contact_id is not null and exists (select 1 from (${attributed("b")}) x)) as bought
      from base b
      left join lateral (select status from conversation_messages m where m.conversation_id = b.conversation_id
                          and m.direction = 'outbound' and m.provider_message_id = b.provider_message_id limit 1) m on b.provider_message_id is not null
  ), states as (
    select f.*, case
        when f.status in ('pending', 'sending') then 'pending'
        when f.status = 'failed' then 'failed'
        when f.status = 'opted_out' or f.left_after then 'opted_out'
        when f.status = 'cancelled' then 'skipped'
        when f.bought then 'bought'
        when f.replied then 'replied'
        when f.message_status = 'read' then 'read'
        when f.message_status = 'delivered' then 'delivered'
        else 'sent' end as state
      from facts f
  )`;

interface StatsRow {
  readonly key: string;
  readonly total: string;
  readonly pending: string;
  readonly sent: string;
  readonly failed: string;
  readonly skipped: string;
  readonly delivered: string;
  readonly read: string;
  readonly replied: string;
  readonly opted_out: string;
  readonly bought: string;
}

const COUNTS = `count(*) as total,
  count(*) filter (where status in ('pending', 'sending')) as pending,
  count(*) filter (where status = 'sent') as sent,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status in ('opted_out', 'cancelled')) as skipped,
  count(*) filter (where status = 'sent' and (message_status in ('delivered', 'read') or replied)) as delivered,
  count(*) filter (where status = 'sent' and (message_status = 'read' or replied)) as read,
  count(*) filter (where replied) as replied,
  count(*) filter (where state = 'opted_out') as opted_out,
  count(*) filter (where bought) as bought`;

const n = (value: string | undefined) => Number(value ?? 0);
const READ_STATES: ReadonlyArray<RecipientState> = ["read", "replied", "bought"];
const FILTER_SQL: Readonly<Record<RecipientFilter, string>> = {
  all: "true",
  bought: "state = 'bought'",
  replied: "state in ('replied', 'bought')",
  read: `state in (${READ_STATES.map((state) => `'${state}'`).join(", ")})`,
  unread: "state in ('sent', 'delivered')",
  failed: "state = 'failed'"
};

export class SqlBroadcastResults implements BroadcastResults {
  public constructor(private readonly sql: SqlClient) {}

  public async stats(tenantId: string, broadcastIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, BroadcastStats>> {
    if (broadcastIds.length === 0) return new Map();
    const [counts, money] = await Promise.all([
      this.sql.query<StatsRow>(`${FACTS} select broadcast_id::text as key, ${COUNTS} from states group by broadcast_id`, [tenantId, broadcastIds]),
      this.revenue(tenantId, broadcastIds, "broadcast_id::text")
    ]);
    return new Map(counts.rows.map((row) => [row.key, { ...toStats(row), revenue: money.get(row.key) ?? [] }]));
  }

  public async variants(tenantId: string, broadcastId: string): Promise<ReadonlyArray<VariantResult>> {
    const [counts, money] = await Promise.all([
      this.sql.query<StatsRow>(`${FACTS} select variant::text as key, ${COUNTS} from states where variant is not null group by variant order by variant`, [tenantId, [broadcastId]]),
      this.revenue(tenantId, [broadcastId], "variant::text")
    ]);
    return counts.rows.map((row) => ({ variant: Number(row.key), sent: n(row.sent), replied: n(row.replied), bought: n(row.bought), revenue: money.get(row.key) ?? [] }));
  }

  public async recipients(tenantId: string, broadcastId: string, filter: RecipientFilter, offset: number, limit: number): Promise<RecipientsPage> {
    const counts = await this.sql.query<Record<RecipientFilter, string>>(
      `${FACTS} select ${Object.entries(FILTER_SQL).map(([key, sql]) => `count(*) filter (where ${sql}) as "${key}"`).join(", ")} from states`,
      [tenantId, [broadcastId]]
    );
    const page = await this.sql.query<{ id: string; contact_id: string | null; name: string | null; phone: string; connection_name: string | null; state: RecipientState; variant: number | null; sent_at: Date | null; error: string | null; sale_amount: string | null; sale_currency: string | null }>(
      `${FACTS}
       select st.id, st.contact_id, coalesce(ct.name, st.name) as name, st.phone, w.name as connection_name, st.state, st.variant, st.sent_at, st.error,
              sale.amount as sale_amount, sale.currency as sale_currency
         from states st
         left join contacts ct on ct.tenant_id = st.tenant_id and ct.id = st.contact_id
         left join whatsapp_connections w on w.id = st.connection_id
         left join lateral (select x.currency, sum(x.amount) as amount from (${attributed("st")}) x
                             group by x.currency order by sum(x.amount) desc limit 1) sale on st.bought
        where ${FILTER_SQL[filter]}
        order by (st.state = 'bought') desc, st.sent_at desc nulls last, st.position
        limit $3 offset $4`,
      [tenantId, [broadcastId], limit + 1, offset]
    );
    const row0 = counts.rows[0];
    return {
      recipients: page.rows.slice(0, limit).map((row) => ({
        id: row.id,
        contactId: row.contact_id,
        name: row.name,
        phone: row.phone,
        connectionName: row.connection_name ?? "Número eliminado",
        state: row.state,
        variant: row.variant,
        sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
        error: row.error,
        sale: row.sale_amount && row.sale_currency ? { amount: Number(row.sale_amount), currency: row.sale_currency } : null
      })),
      counts: { all: n(row0?.all), bought: n(row0?.bought), replied: n(row0?.replied), read: n(row0?.read), unread: n(row0?.unread), failed: n(row0?.failed) },
      nextOffset: page.rows.length > limit ? offset + limit : null
    };
  }

  /** Lo vendido por moneda, agrupado por difusión o por versión. */
  private async revenue(tenantId: string, broadcastIds: ReadonlyArray<string>, key: string): Promise<Map<string, MoneyAmount[]>> {
    const result = await this.sql.query<{ key: string; currency: string; amount: string }>(
      `select r.${key} as key, s.currency, sum(s.amount) as amount
         from broadcast_recipients r
         cross join lateral (${attributed("r")}) s
        where r.tenant_id = $1 and r.broadcast_id = any($2::uuid[]) and r.status = 'sent' and r.contact_id is not null
        group by r.${key}, s.currency`,
      [tenantId, broadcastIds]
    );
    const byKey = new Map<string, MoneyAmount[]>();
    for (const row of result.rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), { currency: row.currency, amount: Number(row.amount) }]);
    return new Map([...byKey].map(([k, amounts]) => [k, mergeMoney(amounts)]));
  }
}

function toStats(row: StatsRow): Omit<BroadcastStats, "revenue"> {
  return {
    total: n(row.total),
    pending: n(row.pending),
    sent: n(row.sent),
    failed: n(row.failed),
    skipped: n(row.skipped),
    delivered: n(row.delivered),
    read: n(row.read),
    replied: n(row.replied),
    optedOut: n(row.opted_out),
    bought: n(row.bought)
  };
}
