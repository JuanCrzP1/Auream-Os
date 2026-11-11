import type { CampaignStats, GroupNumbers } from "../../../contracts/GroupContracts";
import type { MoneyAmount } from "../../../contracts/BroadcastResultsContracts";
import type { GroupResults } from "../../../domains/groups/application/GroupPorts";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlGroupResults — lo que logra cada grupo y cada campaña, leído de donde
// vive cada dato:
//   · entraron / salieron: `wa_group_members` (solo entradas por aviso, no las
//     de la primera sincronización)
//   · compró: una venta aprobada de alguien que ESTABA en el grupo cuando
//     compró (por su teléfono). Cada venta cuenta una vez por grupo y por campaña
//   · clics: `group_link_clicks`
// ---------------------------------------------------------------------------

/** Las ventas hechas mientras la persona estaba en el grupo `m`. `$1` cuenta, `$3` desde. */
const SALES_OF_MEMBERS = `select m.group_id, s.id as sale_id, s.currency, s.amount, coalesce(c.phone, s.customer_phone) as phone
  from wa_group_members m
  join sales s on s.tenant_id = m.tenant_id and s.status = 'approved' and s.sold_at >= m.joined_at and (m.left_at is null or s.sold_at <= m.left_at)
  left join contacts c on c.tenant_id = s.tenant_id and c.id = s.contact_id
  where m.tenant_id = $1 and m.phone is not null and m.phone = coalesce(c.phone, s.customer_phone)
    and s.amount is not null and s.currency is not null and ($3::timestamptz is null or s.sold_at >= $3)`;

const n = (value: string | null | undefined) => Number(value ?? 0);

function money(rows: ReadonlyArray<{ key: string; currency: string; amount: string }>): Map<string, MoneyAmount[]> {
  const byKey = new Map<string, MoneyAmount[]>();
  for (const row of rows) byKey.set(row.key, [...(byKey.get(row.key) ?? []), { currency: row.currency, amount: Number(row.amount) }]);
  for (const [key, list] of byKey) byKey.set(key, list.sort((a, b) => b.amount - a.amount));
  return byKey;
}

export class SqlGroupResults implements GroupResults {
  public constructor(private readonly sql: SqlClient) {}

  public async groups(tenantId: string, groupIds: ReadonlyArray<string>, since: Date | null): Promise<ReadonlyMap<string, GroupNumbers>> {
    if (groupIds.length === 0) return new Map();
    const [moves, buys, revenue] = await Promise.all([
      this.sql.query<{ key: string; members: string; joined: string; left: string }>(
        `select g.id::text as key, max(g.members) as members,
                count(m.member_key) filter (where m.source = 'event' and ($3::timestamptz is null or m.joined_at >= $3)) as joined,
                count(m.member_key) filter (where m.left_at is not null and ($3::timestamptz is null or m.left_at >= $3)) as left
           from wa_groups g left join wa_group_members m on m.group_id = g.id
          where g.tenant_id = $1 and g.id = any($2::uuid[]) group by g.id`,
        [tenantId, groupIds, since]
      ),
      this.sql.query<{ key: string; buyers: string }>(`select x.group_id::text as key, count(distinct x.phone) as buyers from (${SALES_OF_MEMBERS} and m.group_id = any($2::uuid[])) x group by x.group_id`, [tenantId, groupIds, since]),
      this.sql.query<{ key: string; currency: string; amount: string }>(
        `select y.key, y.currency, sum(y.amount) as amount from (select distinct x.group_id::text as key, x.sale_id, x.currency, x.amount from (${SALES_OF_MEMBERS} and m.group_id = any($2::uuid[])) x) y group by y.key, y.currency`,
        [tenantId, groupIds, since]
      )
    ]);
    const buyers = new Map(buys.rows.map((row) => [row.key, n(row.buyers)]));
    const amounts = money(revenue.rows);
    return new Map(moves.rows.map((row) => [row.key, { members: n(row.members), joined: n(row.joined), left: n(row.left), buyers: buyers.get(row.key) ?? 0, revenue: amounts.get(row.key) ?? [] }]));
  }

  public async campaigns(tenantId: string, campaignIds: ReadonlyArray<string>, since: Date | null): Promise<ReadonlyMap<string, CampaignStats>> {
    if (campaignIds.length === 0) return new Map();
    const params = [tenantId, campaignIds, since];
    const ofCampaigns = `${SALES_OF_MEMBERS} and m.group_id in (select id from wa_groups where tenant_id = $1 and campaign_id = any($2::uuid[]))`;
    const [moves, clicks, buys, revenue] = await Promise.all([
      this.sql.query<{ key: string; members: string; joined: string; left: string }>(
        `select g.campaign_id::text as key,
                (select coalesce(sum(g2.members), 0) from wa_groups g2 where g2.campaign_id = g.campaign_id and g2.removed_at is null) as members,
                count(m.member_key) filter (where m.source = 'event' and ($3::timestamptz is null or m.joined_at >= $3)) as joined,
                count(m.member_key) filter (where m.left_at is not null and ($3::timestamptz is null or m.left_at >= $3)) as left
           from wa_groups g left join wa_group_members m on m.group_id = g.id
          where g.tenant_id = $1 and g.campaign_id = any($2::uuid[]) group by g.campaign_id`,
        params
      ),
      this.sql.query<{ key: string; clicks: string }>(
        "select campaign_id::text as key, count(*) as clicks from group_link_clicks where tenant_id = $1 and campaign_id = any($2::uuid[]) and ($3::timestamptz is null or created_at >= $3) group by campaign_id",
        params
      ),
      this.sql.query<{ key: string; buyers: string }>(
        `select g.campaign_id::text as key, count(distinct x.phone) as buyers from (${ofCampaigns}) x join wa_groups g on g.id = x.group_id group by g.campaign_id`,
        params
      ),
      this.sql.query<{ key: string; currency: string; amount: string }>(
        `select y.key, y.currency, sum(y.amount) as amount from (select distinct g.campaign_id::text as key, x.sale_id, x.currency, x.amount from (${ofCampaigns}) x join wa_groups g on g.id = x.group_id) y group by y.key, y.currency`,
        params
      )
    ]);
    const byKey = <T extends { key: string }>(rows: ReadonlyArray<T>) => new Map(rows.map((row) => [row.key, row]));
    const [m, c, b, r] = [byKey(moves.rows), byKey(clicks.rows), byKey(buys.rows), money(revenue.rows)];
    return new Map(
      campaignIds.map((id) => [id, { clicks: n(c.get(id)?.clicks), members: n(m.get(id)?.members), joined: n(m.get(id)?.joined), left: n(m.get(id)?.left), buyers: n(b.get(id)?.buyers), revenue: r.get(id) ?? [] }])
    );
  }

  public async daily(tenantId: string, campaignId: string, days: number, timezone: string) {
    const result = await this.sql.query<{ day: string; clicks: string; joined: string; left: string }>(
      `with span as (select generate_series((now() at time zone $3)::date - ($4::int - 1), (now() at time zone $3)::date, interval '1 day')::date as day),
            grp as (select id from wa_groups where tenant_id = $1 and campaign_id = $2)
       select to_char(s.day, 'YYYY-MM-DD') as day,
              (select count(*) from group_link_clicks k where k.campaign_id = $2 and (k.created_at at time zone $3)::date = s.day) as clicks,
              (select count(*) from wa_group_members m where m.group_id in (select id from grp) and m.source = 'event' and (m.joined_at at time zone $3)::date = s.day) as joined,
              (select count(*) from wa_group_members m where m.group_id in (select id from grp) and (m.left_at at time zone $3)::date = s.day) as left
         from span s order by s.day`,
      [tenantId, campaignId, timezone, days]
    );
    return result.rows.map((row) => ({ day: row.day, clicks: n(row.clicks), joined: n(row.joined), left: n(row.left) }));
  }
}
