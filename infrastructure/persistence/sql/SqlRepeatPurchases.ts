import type { AdLevel } from "../../../contracts/DashboardContracts";
import type { CohortCount, CohortMoneyDay, RepeatPurchasesReader } from "../../../domains/analytics/application/AdsRepeatService";
import type { Period } from "../../../domains/analytics/application/DashboardPeriod";
import type { DashboardScope } from "../../../domains/analytics/application/DashboardReaders";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlRepeatPurchases — «con recompras». La PRIMERA compra aprobada de cada
// cliente (`distinct on contact_id`, la más antigua) y el anuncio de esa
// compra (de una cuenta elegida, la misma regla del ROAS real). Si esa primera
// compra cayó en el periodo, el cliente es «nuevo» de ese anuncio; sus
// recompras son sus demás compras aprobadas dentro de la ventana, vengan o no
// de un anuncio. Los filtros de números y productos aplican a la primera
// compra (qué clientes trajo la línea); las recompras cuentan todas.
// ---------------------------------------------------------------------------

const keyOf = (level: AdLevel) => (level === "ad" ? "e.external_id" : level === "adset" ? "e.parent_id" : "e.campaign_id");

/** Los clientes nuevos del periodo con el anuncio (o conjunto o campaña) que los trajo. $1 cuenta, $2–$3 periodo. */
function cohortSql(level: AdLevel, scope: DashboardScope | undefined, params: unknown[]): string {
  const filters: string[] = [];
  if (scope?.campaignIds?.length) filters.push(`and e.campaign_id = any($${params.push([...scope.campaignIds])}::text[])`);
  if (scope?.connectionIds?.length) filters.push(`and f.connection_id = any($${params.push([...scope.connectionIds])}::uuid[])`);
  if (scope?.productIds?.length) filters.push(`and f.product_id = any($${params.push([...scope.productIds])}::uuid[])`);
  return `
    with firsts as (
      select distinct on (s.contact_id) s.contact_id, s.id as sale_id, s.sold_at, s.ad_source_id, s.currency, s.amount, s.connection_id, s.product_id
        from sales s
       where s.tenant_id = $1 and s.status = 'approved' and s.contact_id is not null
       order by s.contact_id, s.sold_at, s.id
    ),
    cohort as (
      select f.*, ${keyOf(level)} as entity_id
        from firsts f
        join lateral (select e.* from ad_entities e join ad_accounts a on a.id = e.account_id and a.enabled
                       where e.tenant_id = $1 and e.level = 'ad' and e.external_id = f.ad_source_id limit 1) e on true
       where f.sold_at >= $2 and f.sold_at < $3 and ${keyOf(level)} is not null ${filters.join(" ")}
    )`;
}

/** Una recompra `r` del cliente nuevo `c`: otra compra aprobada suya dentro de la ventana. */
const isRepeat = (windowParam: string) =>
  `r.tenant_id = $1 and r.contact_id = c.contact_id and r.status = 'approved' and r.id <> c.sale_id
   and r.sold_at >= c.sold_at and r.sold_at < c.sold_at + make_interval(days => ${windowParam})`;

export class SqlRepeatPurchases implements RepeatPurchasesReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async money(tenantId: string, period: Period, level: AdLevel, windowDays: number, timezone: string, scope?: DashboardScope): Promise<ReadonlyArray<CohortMoneyDay>> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString()];
    const cohort = cohortSql(level, scope, params);
    const tz = `$${params.push(timezone)}`;
    const days = `$${params.push(windowDays)}::int`;
    const { rows } = await this.sql.query<{ id: string; kind: "first" | "repeat"; day: string; currency: string; amount: string }>(
      `${cohort}
       select c.entity_id as id, 'first' as kind, to_char(c.sold_at at time zone ${tz}, 'YYYY-MM-DD') as day, c.currency, sum(c.amount) as amount
         from cohort c group by 1, 2, 3, 4
       union all
       select c.entity_id as id, 'repeat' as kind, to_char(r.sold_at at time zone ${tz}, 'YYYY-MM-DD') as day, r.currency, sum(r.amount) as amount
         from cohort c join sales r on ${isRepeat(days)}
        group by 1, 2, 3, 4`,
      params
    );
    return rows.map((row) => ({ id: row.id, kind: row.kind, day: row.day, currency: row.currency.trim(), amount: Number(row.amount) }));
  }

  public async counts(tenantId: string, period: Period, level: AdLevel, windowDays: number, scope?: DashboardScope): Promise<ReadonlyArray<CohortCount>> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString()];
    const cohort = cohortSql(level, scope, params);
    const days = `$${params.push(windowDays)}::int`;
    const { rows } = await this.sql.query<{ id: string; new_customers: string; repeat_customers: string }>(
      `${cohort}
       select c.entity_id as id, count(*) as new_customers,
              count(*) filter (where exists (select 1 from sales r where ${isRepeat(days)})) as repeat_customers
         from cohort c
        group by 1`,
      params
    );
    return rows.map((row) => ({ id: row.id, newCustomers: Number(row.new_customers), repeatCustomers: Number(row.repeat_customers) }));
  }
}
