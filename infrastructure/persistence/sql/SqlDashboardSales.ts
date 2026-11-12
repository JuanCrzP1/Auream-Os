import type { RecentSale } from "../../../contracts/DashboardContracts";
import type { Period } from "../../../domains/analytics/application/DashboardPeriod";
import type { BreakdownRow, DashboardScope, LeadCounts, SalesDay, SalesReader } from "../../../domains/analytics/application/DashboardReaders";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlDashboardSales — lo que el Dashboard lee de `sales` (solo aprobadas),
// `product_prices` (el costo), `conversations` (los leads) y `ad_entities`
// (el nombre del anuncio de cada venta). Los días van en la zona de la empresa.
// ---------------------------------------------------------------------------

/** `$1` cuenta · `$2` desde · `$3` hasta (excluido), y los filtros que pidan. */
export function where(period: Period, scope: DashboardScope, params: unknown[]): string {
  params.push(period.from.toISOString(), period.until.toISOString());
  return ["s.tenant_id = $1", "s.status = 'approved'", "s.sold_at >= $2", "s.sold_at < $3", ...saleFilters(scope, params)].join(" and ");
}

/** Números y productos recortan las ventas (cada lista vacía = todos). */
export function saleFilters(scope: DashboardScope, params: unknown[]): string[] {
  const clauses: string[] = [];
  if (scope.connectionIds?.length) {
    params.push([...scope.connectionIds]);
    clauses.push(`s.connection_id = any($${params.length}::uuid[])`);
  }
  if (scope.productIds?.length) {
    params.push([...scope.productIds]);
    clauses.push(`s.product_id = any($${params.length}::uuid[])`);
  }
  return clauses;
}

/** «Por anuncio»: un anuncio de las cuentas conectadas y, si se filtran campañas, de una de ellas. */
export function adCondition(scope: DashboardScope, params: unknown[]): string {
  if (!scope.campaignIds?.length) return "";
  params.push([...scope.campaignIds]);
  return `and e.campaign_id = any($${params.length}::text[])`;
}

export const tzParam = (params: unknown[], timezone: string) => {
  params.push(timezone);
  return `$${params.length}`;
};

export class SqlDashboardSales implements SalesReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async days(tenantId: string, period: Period, scope: DashboardScope, timezone: string): Promise<ReadonlyArray<SalesDay>> {
    const params: unknown[] = [tenantId];
    const condition = where(period, scope, params);
    const tz = tzParam(params, timezone);
    const byCampaign = adCondition(scope, params);
    const { rows } = await this.sql.query<{ day: string; currency: string; amount: string; count: string; ad_amount: string | null; ad_count: string; cost: string | null; without_cost: string }>(
      `select to_char(s.sold_at at time zone ${tz}, 'YYYY-MM-DD') as day, s.currency, sum(s.amount) as amount, count(*) as count,
              sum(s.amount) filter (where ad.known) as ad_amount, count(*) filter (where ad.known) as ad_count,
              sum(pp.cost) as cost, count(*) filter (where pp.cost is null) as without_cost
         from sales s
         left join product_prices pp on pp.product_id = s.product_id and pp.country = s.country and pp.currency = s.currency
         -- «Por anuncio»: solo anuncios de las cuentas conectadas (y de las campañas elegidas): así cuadra con el gasto.
         cross join lateral (select exists (select 1 from ad_entities e where e.tenant_id = s.tenant_id and e.level = 'ad' and e.external_id = s.ad_source_id ${byCampaign}) as known) ad
        where ${condition}
        group by 1, 2`,
      params
    );
    return rows.map((row) => ({
      day: row.day,
      currency: row.currency.trim(),
      amount: Number(row.amount),
      count: Number(row.count),
      adAmount: Number(row.ad_amount ?? 0),
      adCount: Number(row.ad_count),
      cost: Number(row.cost ?? 0),
      withoutCost: Number(row.without_cost)
    }));
  }

  public async byHour(tenantId: string, period: Period, scope: DashboardScope, timezone: string): Promise<ReadonlyArray<number>> {
    const params: unknown[] = [tenantId];
    const condition = where(period, scope, params);
    const tz = tzParam(params, timezone);
    const { rows } = await this.sql.query<{ hour: number; count: string }>(
      `select extract(hour from s.sold_at at time zone ${tz})::int as hour, count(*) as count from sales s where ${condition} group by 1`,
      params
    );
    const hours = Array.from({ length: 24 }, () => 0);
    for (const row of rows) hours[row.hour] = Number(row.count);
    return hours;
  }

  public async breakdown(tenantId: string, period: Period, scope: DashboardScope, timezone: string, by: "connection" | "product" | "country"): Promise<ReadonlyArray<BreakdownRow>> {
    const params: unknown[] = [tenantId];
    const condition = where(period, scope, params);
    const tz = tzParam(params, timezone);
    const [key, label, join] =
      by === "connection" ? ["coalesce(s.connection_id::text, 'none')", "coalesce(c.name, 'Anotadas a mano')", "left join whatsapp_connections c on c.tenant_id = s.tenant_id and c.id = s.connection_id"]
      : by === "product" ? ["coalesce(s.product_id::text, 'none')", "coalesce(max(s.product_name), 'Sin producto')", ""]
      : ["coalesce(s.country, '--')", "coalesce(s.country, '--')", ""];
    const { rows } = await this.sql.query<{ key: string; label: string; day: string; currency: string; amount: string; count: string }>(
      `select ${key} as key, ${label} as label, to_char(s.sold_at at time zone ${tz}, 'YYYY-MM-DD') as day, s.currency, sum(s.amount) as amount, count(*) as count
         from sales s ${join}
        where ${condition}
        group by ${by === "product" ? "1, 3, 4" : "1, 2, 3, 4"}`,
      params
    );
    return rows.map((row) => ({ key: row.key.trim(), label: row.label.trim(), day: row.day, currency: row.currency.trim(), amount: Number(row.amount), count: Number(row.count) }));
  }

  public async leads(tenantId: string, period: Period, scope: DashboardScope): Promise<LeadCounts> {
    const params: unknown[] = [tenantId, period.from.toISOString(), period.until.toISOString()];
    const byConnection = scope.connectionIds?.length ? (params.push([...scope.connectionIds]), `and v.connection_id = any($${params.length}::uuid[])`) : "";
    const byProduct = scope.productIds?.length ? (params.push([...scope.productIds]), `and s.product_id = any($${params.length}::uuid[])`) : "";
    // Compró: una venta aprobada del mismo cliente dentro del periodo (la de un
    // flujo trae el contacto; una anotada a mano, solo el teléfono).
    const { rows } = await this.sql.query<{ total: string; from_ads: string; converted: string }>(
      `select count(*) as total,
              count(*) filter (where ct.ad_origin ->> 'sourceId' is not null) as from_ads,
              count(*) filter (where exists (
                select 1 from sales s
                 where s.tenant_id = v.tenant_id and s.status = 'approved' and s.sold_at >= $2 and s.sold_at < $3 ${byProduct}
                   and (s.contact_id = v.contact_id or (s.contact_id is null and s.customer_phone is not null and s.customer_phone = ct.phone))
              )) as converted
         from conversations v left join contacts ct on ct.tenant_id = v.tenant_id and ct.id = v.contact_id
        where v.tenant_id = $1 and v.created_at >= $2 and v.created_at < $3 ${byConnection}`,
      params
    );
    return { total: Number(rows[0]?.total ?? 0), fromAds: Number(rows[0]?.from_ads ?? 0), converted: Number(rows[0]?.converted ?? 0) };
  }

  public async reviewCount(tenantId: string): Promise<number> {
    const { rows } = await this.sql.query<{ n: string }>(`select count(*) as n from sales where tenant_id = $1 and status = 'review'`, [tenantId]);
    return Number(rows[0]?.n ?? 0);
  }

  public async recent(tenantId: string, scope: DashboardScope, limit: number): Promise<ReadonlyArray<RecentSale>> {
    const params: unknown[] = [tenantId];
    const filters = saleFilters(scope, params).map((clause) => `and ${clause}`).join(" ");
    params.push(limit);
    const { rows } = await this.sql.query<{ id: string; customer_name: string | null; product_name: string | null; amount: string; currency: string; ad_name: string | null; connection_name: string | null; sold_at: Date | string }>(
      `select s.id, s.customer_name, s.product_name, s.amount, s.currency, coalesce(e.name, case when s.ad_source_id is not null then 'Anuncio ' || s.ad_source_id end) as ad_name, c.name as connection_name, s.sold_at
         from sales s
         left join whatsapp_connections c on c.tenant_id = s.tenant_id and c.id = s.connection_id
         left join lateral (select name from ad_entities where tenant_id = s.tenant_id and level = 'ad' and external_id = s.ad_source_id limit 1) e on true
        where s.tenant_id = $1 and s.status = 'approved' ${filters}
        order by s.sold_at desc, s.id desc
        limit $${params.length}`,
      params
    );
    return rows.map((row) => ({
      id: row.id,
      customerName: row.customer_name,
      productName: row.product_name,
      amount: Number(row.amount),
      currency: row.currency.trim(),
      adName: row.ad_name ?? null,
      connectionName: row.connection_name,
      soldAt: (row.sold_at instanceof Date ? row.sold_at : new Date(row.sold_at)).toISOString()
    }));
  }
}
