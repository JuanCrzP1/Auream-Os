import type { SaleSource, SaleStatus, SalesTotal } from "../../../contracts/SalesContracts";
import type { SaleChanges, SaleCursor, SaleQuery, SaleRecord, SaleRepository } from "../../../domains/sales/application/SaleRepository";
import type { NewSale } from "../../../domains/sales/domain/Sale";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlSaleRepository — `sales` (031). Al leer suma los nombres de la conexión
// que vendió, la automatización y quien la anotó. `origin_key` (índice único
// parcial) hace que el mismo comprobante o paso no se guarde dos veces.
// ---------------------------------------------------------------------------

interface SaleRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly status: string;
  readonly source: string;
  readonly product_id: string | null;
  readonly product_name: string | null;
  readonly amount: string | number | null;
  readonly currency: string | null;
  readonly country: string | null;
  readonly contact_id: string | null;
  readonly customer_name: string | null;
  readonly customer_phone: string | null;
  readonly connection_id: string | null;
  readonly flow_key: string | null;
  readonly ad_source_id: string | null;
  readonly receipt_reference: string | null;
  readonly review_reason: string | null;
  readonly note: string;
  readonly recorded_by: string | null;
  readonly sold_at: Date | string;
  readonly connection_name: string | null;
  readonly flow_name: string | null;
  readonly recorded_by_name: string | null;
}

const SELECT = `select s.*, c.name as connection_name, a.name as flow_name, coalesce(u.display_name, u.email) as recorded_by_name
                  from sales s
                  left join whatsapp_connections c on c.tenant_id = s.tenant_id and c.id = s.connection_id
                  left join automations a on a.tenant_id = s.tenant_id and a.key = s.flow_key
                  left join user_profiles u on u.user_id = s.recorded_by`;

function toRecord(row: SaleRow): SaleRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    status: row.status as SaleStatus,
    source: row.source as SaleSource,
    productId: row.product_id,
    productName: row.product_name,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency?.trim() ?? null,
    country: row.country?.trim() ?? null,
    contactId: row.contact_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    connectionId: row.connection_id,
    flowKey: row.flow_key,
    adSourceId: row.ad_source_id,
    receiptReference: row.receipt_reference,
    reviewReason: row.review_reason,
    note: row.note,
    recordedBy: row.recorded_by,
    soldAt: (row.sold_at instanceof Date ? row.sold_at : new Date(row.sold_at)).toISOString(),
    connectionName: row.connection_name,
    flowName: row.flow_name,
    recordedByName: row.recorded_by_name
  };
}

/** Los filtros como SQL con parámetros numerados a partir de `$2` (`$1` es la cuenta). */
function where(query: SaleQuery, params: unknown[]): string {
  const clauses = ["s.tenant_id = $1"];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    clauses.push(sql.replace("?", `$${params.length}`));
  };
  if (query.status) add("s.status = ?", query.status);
  if (query.productId) add("s.product_id = ?", query.productId);
  if (query.currency) add("s.currency = ?", query.currency);
  if (query.source) add("s.source = ?", query.source);
  if (query.from) add("s.sold_at >= ?", query.from.toISOString());
  if (query.until) add("s.sold_at < ?", query.until.toISOString());
  if (query.search) {
    // Nombre, teléfono o referencia que contengan el texto; el anuncio, exacto.
    params.push(`%${query.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`, query.search);
    const like = `$${params.length - 1}`;
    const exact = `$${params.length}`;
    clauses.push(`(s.customer_name ilike ${like} or s.customer_phone like ${like} or s.receipt_reference ilike ${like} or s.ad_source_id = ${exact})`);
  }
  return clauses.join(" and ");
}

export class SqlSaleRepository implements SaleRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async insert(tenantId: string, sale: NewSale, status: SaleStatus, reviewReason: string | null) {
    const inserted = await this.sql.query<{ id: string }>(
      `insert into sales (tenant_id, status, source, product_id, product_name, amount, currency, country, contact_id, customer_name,
                          customer_phone, connection_id, flow_key, ad_source_id, receipt_reference, origin_key, review_reason, note, recorded_by, sold_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       on conflict (tenant_id, origin_key) where origin_key is not null do nothing
       returning id`,
      [
        tenantId, status, sale.source, sale.productId, sale.productName, sale.amount, sale.currency, sale.country, sale.contactId, sale.customerName,
        sale.customerPhone, sale.connectionId, sale.flowKey, sale.adSourceId, sale.receiptReference, sale.originKey, reviewReason, sale.note, sale.recordedBy, sale.soldAt
      ]
    );
    const created = inserted.rows.length > 0;
    const existing = created
      ? await this.find(tenantId, inserted.rows[0]!.id)
      : (await this.sql.query<SaleRow>(`${SELECT} where s.tenant_id = $1 and s.origin_key = $2`, [tenantId, sale.originKey])).rows.map(toRecord)[0] ?? null;
    if (!existing) throw new Error("La venta no se pudo leer después de guardarla.");
    return { sale: existing, created };
  }

  public async find(tenantId: string, saleId: string): Promise<SaleRecord | null> {
    const result = await this.sql.query<SaleRow>(`${SELECT} where s.tenant_id = $1 and s.id = $2`, [tenantId, saleId]);
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  }

  public async update(tenantId: string, saleId: string, changes: SaleChanges): Promise<SaleRecord | null> {
    const result = await this.sql.query<{ id: string }>(
      `update sales set status = $3, product_id = $4, product_name = $5, amount = $6, currency = $7, country = $8,
                        customer_name = $9, note = $10, review_reason = $11, recorded_by = $12, updated_at = now()
        where tenant_id = $1 and id = $2 returning id`,
      [tenantId, saleId, changes.status, changes.productId, changes.productName, changes.amount, changes.currency, changes.country,
       changes.customerName, changes.note, changes.reviewReason, changes.recordedBy]
    );
    return result.rows.length > 0 ? this.find(tenantId, saleId) : null;
  }

  public async list(tenantId: string, query: SaleQuery, cursor: SaleCursor | null, limit: number): Promise<ReadonlyArray<SaleRecord>> {
    const params: unknown[] = [tenantId];
    let condition = where(query, params);
    if (cursor) {
      params.push(cursor.soldAt, cursor.id);
      condition += ` and (s.sold_at, s.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(limit);
    const result = await this.sql.query<SaleRow>(`${SELECT} where ${condition} order by s.sold_at desc, s.id desc limit $${params.length}`, params);
    return result.rows.map(toRecord);
  }

  public async totals(tenantId: string, query: SaleQuery): Promise<ReadonlyArray<SalesTotal>> {
    const params: unknown[] = [tenantId];
    const condition = where({ ...query, status: "approved" }, params);
    const result = await this.sql.query<{ currency: string; amount: string; count: string }>(
      `select s.currency, sum(s.amount) as amount, count(*) as count from sales s where ${condition} group by s.currency order by sum(s.amount) desc`,
      params
    );
    return result.rows.map((row) => ({ currency: row.currency.trim(), amount: Number(row.amount), count: Number(row.count) }));
  }

  public async countByStatus(tenantId: string, status: SaleStatus): Promise<number> {
    const result = await this.sql.query<{ total: string }>(`select count(*) as total from sales where tenant_id = $1 and status = $2`, [tenantId, status]);
    return Number(result.rows[0]?.total ?? 0);
  }
}
