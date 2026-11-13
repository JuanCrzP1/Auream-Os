import type { FieldInsights, ValueSales } from "../../../domains/contact-fields/application/ContactFieldToolPorts";
import type { ObservedValues } from "../../../domains/contact-fields/domain/fieldDiscovery";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// Lo que se LEE de los clientes para las herramientas del catálogo: los
// valores escritos de un campo, cuántos clientes tienen varias claves a la vez
// y lo que vende cada valor. Solo lectura; todo filtra por cuenta.
// ---------------------------------------------------------------------------

export class SqlContactFieldInsights implements FieldInsights {
  public constructor(private readonly sql: SqlClient) {}

  public async values(tenantId: string, key: string, limit: number): Promise<ObservedValues> {
    const { rows } = await this.sql.query<{ filled: string; distinct: string; top: Array<{ value: string; count: number }> }>(
      `with counted as (
         select c.custom_fields ->> $2 as value, count(*) as n from contacts c
          where c.tenant_id = $1 and c.custom_fields ? $2 and coalesce(c.custom_fields ->> $2, '') <> '' group by 1
       )
       select (select coalesce(sum(n), 0) from counted) as filled, (select count(*) from counted) as distinct,
              coalesce((select jsonb_agg(jsonb_build_object('value', t.value, 'count', t.n) order by t.n desc, t.value)
                          from (select value, n from counted order by n desc, value limit $3) t), '[]'::jsonb) as top`,
      [tenantId, key, limit]
    );
    const row = rows[0]!;
    return { filled: Number(row.filled), distinct: Number(row.distinct), top: row.top.map((entry) => ({ value: entry.value, count: Number(entry.count) })) };
  }

  public async conflicts(tenantId: string, keys: ReadonlyArray<string>): Promise<number> {
    const { rows } = await this.sql.query<{ count: string }>(
      `select count(*) as count from contacts c
        where c.tenant_id = $1 and (select count(*) from unnest($2::text[]) k where coalesce(c.custom_fields ->> k, '') <> '') > 1`,
      [tenantId, [...keys]]
    );
    return Number(rows[0]?.count ?? 0);
  }

  public async salesByValue(tenantId: string, key: string, since: Date): Promise<ReadonlyArray<ValueSales>> {
    const { rows } = await this.sql.query<{ value: string | null; currency: string; amount: string; sales: string; clients: string }>(
      // Una venta anotada a mano solo con el teléfono es del cliente de ese teléfono (igual que en el Dashboard y Grupos).
      `select nullif(c.custom_fields ->> $2, '') as value, s.currency, sum(s.amount) as amount, count(*) as sales,
              count(distinct coalesce(s.contact_id::text, s.customer_phone, s.id::text)) as clients
         from sales s left join contacts c on c.tenant_id = s.tenant_id
              and (c.id = s.contact_id or (s.contact_id is null and s.customer_phone is not null and c.phone = s.customer_phone))
        where s.tenant_id = $1 and s.status = 'approved' and s.sold_at >= $3 and s.amount is not null and s.currency is not null
        group by 1, 2`,
      [tenantId, key, since]
    );
    return rows.map((row) => ({ value: row.value, currency: row.currency.trim(), amount: Number(row.amount), sales: Number(row.sales), clients: Number(row.clients) }));
  }
}
