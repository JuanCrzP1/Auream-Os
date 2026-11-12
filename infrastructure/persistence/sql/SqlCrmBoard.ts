import { countryOfPhone } from "../../../contracts/Countries";
import type { DealCard, Money } from "../../../contracts/CrmContracts";
import type { BoardQuery, BoardReader, StageCount } from "../../../domains/crm/application/CrmRepositories";
import type { Pipeline } from "../../../domains/crm/domain/Pipeline";
import type { SqlExecutor } from "./SqlClient";
import { membersSql } from "./sqlCrmBoardMembers";

// ---------------------------------------------------------------------------
// SqlCrmBoard — el tablero de un embudo: las compras actuales (por sus
// etiquetas) y las anteriores (donde terminaron), con su valor, responsable,
// seguimiento y lo que lleva comprado cada cliente (`sqlCrmBoardMembers`).
// También los números: lo vendido, los días hasta comprar y la recompra.
// ---------------------------------------------------------------------------

interface CardRow {
  readonly contact_id: string;
  readonly stage_id: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly amount: string | null;
  readonly currency: string | null;
  readonly product_name: string | null;
  readonly owner_id: string | null;
  readonly owner_name: string | null;
  readonly entered_at: Date | string;
  readonly follow_id: string | null;
  readonly follow_title: string | null;
  readonly follow_due: Date | string | null;
  readonly last_message_at: Date | string | null;
  readonly deal_id: string | null;
  readonly number: number;
  readonly current: boolean;
  readonly bought_amount: string | null;
  readonly bought_currency: string | null;
}

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();
const money = (amount: string | number | null, currency: string | null): Money | null => (amount === null || currency === null ? null : { amount: Number(amount), currency: currency.trim() });

export class SqlCrmBoard implements BoardReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async counts(tenantId: string, pipeline: Pipeline, query: BoardQuery): Promise<ReadonlyArray<StageCount>> {
    const params: unknown[] = [tenantId, pipeline.id];
    const result = await this.sql.query<{ stage_id: string; currency: string | null; count: string; amount: string | null }>(
      `${membersSql(query, params)}
       select stage_id, currency, count(*) as count, sum(amount) as amount from f group by stage_id, currency`,
      params
    );
    const byStage = new Map<string, { count: number; totals: Money[] }>();
    for (const row of result.rows) {
      const entry = byStage.get(row.stage_id) ?? { count: 0, totals: [] };
      entry.count += Number(row.count);
      const total = money(row.amount, row.currency);
      if (total) entry.totals.push(total);
      byStage.set(row.stage_id, entry);
    }
    return [...byStage].map(([stageId, entry]) => ({ stageId, count: entry.count, totals: entry.totals.sort((a, b) => b.amount - a.amount) }));
  }

  /** Por etapa: de la posición `offset` en adelante, hasta `limit` (los que entraron más recientemente primero). */
  public async cards(tenantId: string, pipeline: Pipeline, stageIds: ReadonlyArray<string>, query: BoardQuery, offset: number, limit: number): Promise<ReadonlyArray<DealCard>> {
    if (stageIds.length === 0) return [];
    const params: unknown[] = [tenantId, pipeline.id];
    const members = membersSql(query, params);
    params.push([...stageIds], offset, offset + limit);
    const [stages, from, to] = [params.length - 2, params.length - 1, params.length];
    const result = await this.sql.query<CardRow>(
      `${members},
       r as (select f.*, row_number() over (partition by f.stage_id order by f.entered_at desc, f.contact_id, f.number desc) as rn
               from f where f.stage_id = any($${stages}::uuid[]))
       select r.contact_id, r.stage_id, r.name, r.phone, r.amount, r.currency, r.product_name, r.owner_id, r.entered_at,
              r.deal_id, r.number, r.current,
              coalesce(u.display_name, u.email) as owner_name,
              fu.id as follow_id, fu.title as follow_title, fu.due_at as follow_due, conv.last_message_at,
              bought.amount as bought_amount, bought.currency as bought_currency
         from r
         left join user_profiles u on u.user_id = r.owner_id
         left join lateral (select id, title, due_at from crm_follow_ups
                             where tenant_id = $1 and contact_id = r.contact_id and done_at is null
                             order by due_at limit 1) fu on true
         left join lateral (select max(last_message_at) as last_message_at from conversations
                             where tenant_id = $1 and contact_id = r.contact_id) conv on true
         left join lateral (select currency, sum(amount) as amount from crm_deals
                             where r.number > 1 and tenant_id = $1 and pipeline_id = $2 and contact_id = r.contact_id
                               and won_at is not null and amount is not null
                             group by currency order by sum(amount) desc limit 1) bought on true
        where r.rn > $${from} and r.rn <= $${to}
        order by r.stage_id, r.rn`,
      params
    );
    return result.rows.map((row) => ({
      contactId: row.contact_id,
      dealId: row.deal_id,
      number: row.number,
      current: row.current,
      boughtTotal: money(row.bought_amount, row.bought_currency),
      name: row.name,
      phone: row.phone,
      country: countryOfPhone(row.phone),
      stageId: row.stage_id,
      value: money(row.amount, row.currency),
      productName: row.product_name,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      nextFollowUp: row.follow_id && row.follow_title && row.follow_due ? { id: row.follow_id, title: row.follow_title, dueAt: iso(row.follow_due) } : null,
      lastMessageAt: row.last_message_at === null ? null : iso(row.last_message_at),
      enteredAt: iso(row.entered_at)
    }));
  }

  public async won(tenantId: string, pipelineId: string, since: Date, closedSince: Date) {
    const totals = await this.sql.query<{ currency: string | null; amount: string | null; count: string }>(
      `select currency, sum(amount) as amount, count(*) as count from crm_deals
        where tenant_id = $1 and pipeline_id = $2 and won_at >= $3 group by currency`,
      [tenantId, pipelineId, since.toISOString()]
    );
    const speed = await this.sql.query<{ days: string | null }>(
      `select avg(extract(epoch from (won_at - first_entered_at))) / 86400 as days from crm_deals
        where tenant_id = $1 and pipeline_id = $2 and won_at >= $3`,
      [tenantId, pipelineId, closedSince.toISOString()]
    );
    const days = speed.rows[0]?.days;
    return {
      totals: totals.rows.map((row) => money(row.amount, row.currency)).filter((value): value is Money => value !== null).sort((a, b) => b.amount - a.amount),
      count: totals.rows.reduce((sum, row) => sum + Number(row.count), 0),
      avgDays: days === null || days === undefined ? null : Math.round(Number(days) * 10) / 10
    };
  }

  public async loyalty(tenantId: string, pipelineId: string, since: Date) {
    const repeat = await this.sql.query<{ buyers: string; repeaters: string }>(
      `with buyers as (select contact_id, count(*) as purchases from crm_deals
                        where tenant_id = $1 and pipeline_id = $2 and won_at is not null
                        group by contact_id
                       having max(won_at) >= $3)
       select count(*) as buyers, count(*) filter (where purchases > 1) as repeaters from buyers`,
      [tenantId, pipelineId, since.toISOString()]
    );
    const value = await this.sql.query<{ currency: string; amount: string; buyers: string }>(
      `select currency, sum(amount) as amount, count(distinct contact_id) as buyers from crm_deals
        where tenant_id = $1 and pipeline_id = $2 and won_at is not null and amount is not null
        group by currency order by sum(amount) desc limit 1`,
      [tenantId, pipelineId]
    );
    const buyers = Number(repeat.rows[0]?.buyers ?? 0);
    const main = value.rows[0];
    return {
      repeatRate: buyers > 0 ? Number(repeat.rows[0]!.repeaters) / buyers : null,
      valuePerBuyer: main && Number(main.buyers) > 0 ? { amount: Math.round((Number(main.amount) / Number(main.buyers)) * 100) / 100, currency: main.currency.trim() } : null
    };
  }
}
