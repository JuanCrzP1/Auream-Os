import type { AdLevel } from "../../../contracts/DashboardContracts";
import type { Period } from "../../../domains/analytics/application/DashboardPeriod";
import type { AdsReader, AttributedDay, EntityDay, EntityInfo, SpendDay } from "../../../domains/analytics/application/DashboardReaders";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlDashboardAds — lo que reportó Meta (`ad_insights_daily`, solo cuentas
// elegidas) y las ventas reales de cada anuncio (`sales.ad_source_id` →
// `ad_entities`), agrupadas por campaña, conjunto o anuncio.
// ---------------------------------------------------------------------------

/** La columna que agrupa por nivel, sobre un anuncio `e`. */
const keyOf = (level: AdLevel) => (level === "ad" ? "e.external_id" : level === "adset" ? "e.parent_id" : "e.campaign_id");

interface SpendRow {
  day: string; currency: string; spend: string; impressions: string; clicks: string; conversations: string; meta_purchases: string; meta_revenue: string; id?: string;
}

const toSpend = (row: SpendRow): SpendDay => ({
  day: row.day,
  currency: row.currency.trim(),
  spend: Number(row.spend),
  impressions: Number(row.impressions),
  clicks: Number(row.clicks),
  conversations: Number(row.conversations),
  metaPurchases: Number(row.meta_purchases),
  metaRevenue: Number(row.meta_revenue)
});

const SUMS = `sum(i.spend) as spend, sum(i.impressions) as impressions, sum(i.clicks) as clicks, sum(i.conversations) as conversations,
              sum(i.meta_purchases) as meta_purchases, sum(i.meta_revenue) as meta_revenue`;

export class SqlDashboardAds implements AdsReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async status(tenantId: string) {
    const { rows } = await this.sql.query<{ accounts: string; last_synced_at: Date | string | null; main_currency: string | null; active_campaigns: string }>(
      `select count(*) as accounts, max(a.last_synced_at) as last_synced_at,
              (select a2.currency from ad_accounts a2
                 left join ad_insights_daily i on i.account_id = a2.id and i.day >= current_date - 30
                where a2.tenant_id = $1 and a2.enabled group by a2.id, a2.currency order by coalesce(sum(i.spend), 0) desc limit 1) as main_currency,
              (select count(*) from ad_entities e join ad_accounts a3 on a3.id = e.account_id and a3.enabled
                where e.tenant_id = $1 and e.level = 'campaign' and e.status = 'ACTIVE') as active_campaigns
         from ad_accounts a where a.tenant_id = $1 and a.enabled`,
      [tenantId]
    );
    const row = rows[0];
    const last = row?.last_synced_at ?? null;
    return {
      accounts: Number(row?.accounts ?? 0),
      lastSyncedAt: last === null ? null : (last instanceof Date ? last : new Date(last)).toISOString(),
      mainCurrency: row?.main_currency?.trim() ?? null,
      activeCampaigns: Number(row?.active_campaigns ?? 0)
    };
  }

  public async spend(tenantId: string, period: Period): Promise<ReadonlyArray<SpendDay>> {
    const { rows } = await this.sql.query<SpendRow>(
      `select to_char(i.day, 'YYYY-MM-DD') as day, a.currency, ${SUMS}
         from ad_insights_daily i join ad_accounts a on a.id = i.account_id and a.enabled
        where i.tenant_id = $1 and i.day between $2::date and $3::date
        group by 1, 2`,
      [tenantId, period.fromDay, period.toDay]
    );
    return rows.map(toSpend);
  }

  public async entityDays(tenantId: string, period: Period, level: AdLevel): Promise<ReadonlyArray<EntityDay>> {
    const { rows } = await this.sql.query<SpendRow & { id: string }>(
      `select ${keyOf(level)} as id, to_char(i.day, 'YYYY-MM-DD') as day, a.currency, ${SUMS}
         from ad_insights_daily i
         join ad_accounts a on a.id = i.account_id and a.enabled
         join ad_entities e on e.account_id = i.account_id and e.external_id = i.ad_id
        where i.tenant_id = $1 and i.day between $2::date and $3::date and ${keyOf(level)} is not null
        group by 1, 2, 3`,
      [tenantId, period.fromDay, period.toDay]
    );
    return rows.map((row) => ({ ...toSpend(row), id: row.id }));
  }

  public async entities(tenantId: string, level: AdLevel, ids: ReadonlyArray<string>): Promise<ReadonlyArray<EntityInfo>> {
    if (ids.length === 0) return [];
    const { rows } = await this.sql.query<{ id: string; name: string; status: string; parent_name: string | null; daily_budget: string | null; thumbnail_url: string | null }>(
      `select distinct on (e.external_id) e.external_id as id, e.name, e.status, p.name as parent_name, e.daily_budget, e.thumbnail_url
         from ad_entities e
         left join ad_entities p on p.account_id = e.account_id and p.external_id = e.parent_id
        where e.tenant_id = $1 and e.level = $2 and e.external_id = any($3::text[])
        order by e.external_id, e.updated_at desc`,
      [tenantId, level, [...ids]]
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      parentName: row.parent_name,
      dailyBudget: row.daily_budget === null ? null : Number(row.daily_budget),
      thumbnailUrl: row.thumbnail_url
    }));
  }

  public async attributed(tenantId: string, period: Period, level: AdLevel, timezone: string): Promise<ReadonlyArray<AttributedDay>> {
    const { rows } = await this.sql.query<{ id: string; day: string; currency: string; amount: string; count: string; late: string }>(
      `select ${keyOf(level)} as id, to_char(s.sold_at at time zone $4, 'YYYY-MM-DD') as day, s.currency,
              sum(s.amount) as amount, count(*) as count,
              count(*) filter (where s.sold_at - coalesce(first.at, s.sold_at) > interval '1 day') as late
         from sales s
         join lateral (select e.* from ad_entities e join ad_accounts a on a.id = e.account_id and a.enabled
                        where e.tenant_id = s.tenant_id and e.level = 'ad' and e.external_id = s.ad_source_id limit 1) e on true
         left join lateral (select min(v.created_at) as at from conversations v where v.tenant_id = s.tenant_id and v.contact_id = s.contact_id) first on true
        where s.tenant_id = $1 and s.status = 'approved' and s.sold_at >= $2 and s.sold_at < $3 and ${keyOf(level)} is not null
        group by 1, 2, 3`,
      [tenantId, period.from.toISOString(), period.until.toISOString(), timezone]
    );
    return rows.map((row) => ({ id: row.id, day: row.day, currency: row.currency.trim(), amount: Number(row.amount), count: Number(row.count), late: Number(row.late) }));
  }
}
