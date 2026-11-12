import type { ConnectionAttention } from "../../../contracts/AttentionContracts";
import type { AgentActivity, AgentSale, AttentionReader, ChatCounts } from "../../../domains/analytics/application/AttentionDashboardService";
import type { Period } from "../../../domains/analytics/application/DashboardPeriod";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlDashboardAttention — `conversations` y `conversation_messages` (quién
// escribió y cuándo), y las ventas de cada asesor: las que anotó él o las de
// los clientes de los que es responsable en el CRM (`crm_deals.owner_id`).
// ---------------------------------------------------------------------------

const MINUTES = `extract(epoch from (first_agent - first_contact)) / 60`;

/** Por chat nuevo del periodo: su primer mensaje del cliente, el primero de un asesor y si el bot respondió. */
function threads(connectionFilter: string): string {
  return `with t as (
    select v.id,
           min(m.created_at) filter (where m.author = 'contact') as first_contact,
           min(m.created_at) filter (where m.author = 'agent') as first_agent,
           bool_or(m.author = 'bot') as bot
      from conversations v
      left join conversation_messages m on m.conversation_id = v.id
     where v.tenant_id = $1 and v.created_at >= $2 and v.created_at < $3 ${connectionFilter}
     group by v.id)`;
}

export class SqlDashboardAttention implements AttentionReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async chats(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined): Promise<ChatCounts> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString()];
    const filter = connectionIds?.length ? (params.push([...connectionIds]), `and v.connection_id = any($${params.length}::uuid[])`) : "";
    const { rows } = await this.sql.query<{ leads: string; attended: string; bot_only: string; median: string | null }>(
      `${threads(filter)}
       select count(*) as leads, count(first_agent) as attended, count(*) filter (where first_agent is null and bot) as bot_only,
              percentile_cont(0.5) within group (order by ${MINUTES}) filter (where first_agent is not null and first_contact is not null and first_agent > first_contact) as median
         from t`,
      params
    );
    const row = rows[0];
    return {
      leads: Number(row?.leads ?? 0),
      attended: Number(row?.attended ?? 0),
      botOnly: Number(row?.bot_only ?? 0),
      firstResponseMinutes: row?.median === null || row?.median === undefined ? null : Math.round(Number(row.median) * 10) / 10
    };
  }

  public async waiting(tenantId: string, connectionIds: ReadonlyArray<string> | undefined) {
    const params: unknown[] = [tenantId];
    const filter = connectionIds?.length ? (params.push([...connectionIds]), `and connection_id = any($${params.length}::uuid[])`) : "";
    const { rows } = await this.sql.query<{ n: string; oldest: Date | string | null }>(
      `select count(*) as n, min(last_message_at) as oldest from conversations where tenant_id = $1 and last_message_author = 'contact' ${filter}`,
      params
    );
    const oldest = rows[0]?.oldest ?? null;
    return { count: Number(rows[0]?.n ?? 0), oldestAt: oldest === null ? null : (oldest instanceof Date ? oldest : new Date(oldest)).toISOString() };
  }

  public async heatmap(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined, timezone: string): Promise<number[][]> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString(), timezone];
    const filter = connectionIds?.length ? (params.push([...connectionIds]), `and connection_id = any($${params.length}::uuid[])`) : "";
    const { rows } = await this.sql.query<{ dow: number; block: number; n: string }>(
      `select (extract(isodow from created_at at time zone $4)::int - 1) as dow, (extract(hour from created_at at time zone $4)::int / 2) as block, count(*) as n
         from conversations where tenant_id = $1 and created_at >= $2 and created_at < $3 ${filter} group by 1, 2`,
      params
    );
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
    for (const row of rows) grid[row.dow]![row.block] = Number(row.n);
    return grid;
  }

  public async agents(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined): Promise<ReadonlyArray<AgentActivity>> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString()];
    const filter = connectionIds?.length ? (params.push([...connectionIds]), `and v.connection_id = any($${params.length}::uuid[])`) : "";
    const { rows } = await this.sql.query<{ agent_id: string; name: string | null; attended: string; messages: string; median: string | null }>(
      `with replies as (
         select m.agent_id, m.conversation_id, min(m.created_at) as first_reply, count(*) as messages, max(m.agent_name) as agent_name
           from conversation_messages m join conversations v on v.id = m.conversation_id
          where m.tenant_id = $1 and m.author = 'agent' and m.agent_id is not null and m.created_at >= $2 and m.created_at < $3 ${filter}
          group by 1, 2),
       timed as (
         select r.*, (select max(c.created_at) from conversation_messages c
                       where c.conversation_id = r.conversation_id and c.author = 'contact' and c.created_at < r.first_reply) as asked
           from replies r)
       select t.agent_id, coalesce(max(u.display_name), max(u.email), max(t.agent_name)) as name, count(*) as attended, sum(t.messages) as messages,
              percentile_cont(0.5) within group (order by extract(epoch from (t.first_reply - t.asked)) / 60) filter (where t.asked is not null) as median
         from timed t left join user_profiles u on u.user_id::text = t.agent_id
        group by t.agent_id`,
      params
    );
    return rows.map((row) => ({
      userId: row.agent_id,
      name: row.name ?? "Asesor",
      attended: Number(row.attended),
      messages: Number(row.messages),
      responseMinutes: row.median === null ? null : Math.round(Number(row.median) * 10) / 10
    }));
  }

  public async agentSales(tenantId: string, period: Period, timezone: string): Promise<ReadonlyArray<AgentSale>> {
    const { rows } = await this.sql.query<{ user_id: string; day: string; currency: string; amount: string; count: string }>(
      `select coalesce(d.owner_id, s.recorded_by)::text as user_id, to_char(s.sold_at at time zone $4, 'YYYY-MM-DD') as day, s.currency,
              sum(s.amount) as amount, count(*) as count
         from sales s
         left join lateral (select owner_id from crm_deals where tenant_id = s.tenant_id and contact_id = s.contact_id and owner_id is not null
                             order by updated_at desc limit 1) d on true
        where s.tenant_id = $1 and s.status = 'approved' and s.sold_at >= $2 and s.sold_at < $3 and coalesce(d.owner_id, s.recorded_by) is not null
        group by 1, 2, 3`,
      [tenantId, period.from.toISOString(), period.until.toISOString(), timezone]
    );
    return rows.map((row) => ({ userId: row.user_id, day: row.day, currency: row.currency.trim(), amount: Number(row.amount), count: Number(row.count) }));
  }

  public async connections(tenantId: string, period: Period): Promise<ReadonlyArray<ConnectionAttention>> {
    const { rows } = await this.sql.query<{ id: string; name: string; status: string; leads: string; attended: string; unanswered: string }>(
      `select c.id, c.name, c.status,
              (select count(*) from conversations v where v.connection_id = c.id and v.created_at >= $2 and v.created_at < $3) as leads,
              (select count(distinct m.conversation_id) from conversation_messages m join conversations v on v.id = m.conversation_id
                where v.connection_id = c.id and v.created_at >= $2 and v.created_at < $3 and m.author = 'agent') as attended,
              (select count(*) from conversations v where v.connection_id = c.id and v.last_message_author = 'contact') as unanswered
         from whatsapp_connections c where c.tenant_id = $1 order by c.created_at`,
      [tenantId, period.from.toISOString(), period.until.toISOString()]
    );
    return rows.map((row) => ({ id: row.id, name: row.name, connected: row.status === "connected", leads: Number(row.leads), attended: Number(row.attended), unanswered: Number(row.unanswered) }));
  }
}
