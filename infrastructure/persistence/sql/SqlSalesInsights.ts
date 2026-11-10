import type { SaleQuery } from "../../../domains/sales/application/SaleRepository";
import type { DayAmount, ProductCount, SalesInsightsReader, WeeklyCount } from "../../../domains/sales/application/SalesInsightsReader";
import type { SqlExecutor } from "./SqlClient";
import { saleWhere } from "./SqlSaleRepository";

// ---------------------------------------------------------------------------
// SqlSalesInsights — las sumas de la portada de Ventas sobre `sales` (031),
// SOLO con ventas aprobadas. Los días se cortan en la zona de la empresa.
// ---------------------------------------------------------------------------

export class SqlSalesInsights implements SalesInsightsReader {
  public constructor(private readonly sql: SqlExecutor) {}

  public async daily(tenantId: string, query: SaleQuery, currencies: ReadonlyArray<string>, timezone: string): Promise<ReadonlyArray<DayAmount>> {
    const params: unknown[] = [tenantId];
    const condition = saleWhere({ ...query, status: "approved" }, params);
    params.push([...currencies], timezone);
    const result = await this.sql.query<{ currency: string; day: string; amount: string }>(
      `select s.currency, to_char(s.sold_at at time zone $${params.length}, 'YYYY-MM-DD') as day, sum(s.amount) as amount
         from sales s
        where ${condition} and s.currency = any($${params.length - 1}::text[])
        group by 1, 2`,
      params
    );
    return result.rows.map((row) => ({ currency: row.currency.trim(), day: row.day, amount: Number(row.amount) }));
  }

  public async topProducts(tenantId: string, query: SaleQuery, limit: number): Promise<ReadonlyArray<ProductCount>> {
    const params: unknown[] = [tenantId];
    const condition = saleWhere({ ...query, status: "approved" }, params);
    params.push(limit);
    const result = await this.sql.query<{ product_id: string; name: string; kind: string | null; count: string }>(
      `select s.product_id, coalesce(p.name, max(s.product_name)) as name, p.kind, count(*) as count
         from sales s
         left join products p on p.tenant_id = s.tenant_id and p.id = s.product_id
        where ${condition} and s.product_id is not null
        group by s.product_id, p.name, p.kind
        order by count(*) desc, 2 asc
        limit $${params.length}`,
      params
    );
    return result.rows.map((row) => ({ productId: row.product_id, name: row.name, kind: row.kind, count: Number(row.count) }));
  }

  public async weekly(tenantId: string, since: Date, now: Date): Promise<ReadonlyArray<WeeklyCount>> {
    const result = await this.sql.query<{ product_id: string; weeks_ago: number; count: string }>(
      `select product_id, floor(extract(epoch from ($3::timestamptz - sold_at)) / 604800)::int as weeks_ago, count(*) as count
         from sales
        where tenant_id = $1 and status = 'approved' and product_id is not null and sold_at >= $2 and sold_at <= $3
        group by 1, 2`,
      [tenantId, since.toISOString(), now.toISOString()]
    );
    return result.rows.map((row) => ({ productId: row.product_id, weeksAgo: Number(row.weeks_ago), count: Number(row.count) }));
  }
}
