import type { ProductKind, ProductPrice, ProductStatus } from "../../../contracts/SalesContracts";
import type { ProductRecord, ProductRepository } from "../../../domains/products/application/ProductRepository";
import type { Product, ProductDraft } from "../../../domains/products/domain/Product";
import type { SqlClient, SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlProductRepository — `products` y `product_prices` (031). Guardar un
// producto reemplaza sus precios dentro de una transacción: nunca queda a
// medias. Todo filtra por cuenta.
// ---------------------------------------------------------------------------

interface ProductRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: string;
  readonly status: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly prices: ReadonlyArray<{ country: string; currency: string; amount: string | number; cost: string | number | null }> | null;
  readonly sales_count?: string | number;
}

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();

/** Los precios como JSON, en el orden en que se cargaron. */
const PRICES = `coalesce((select json_agg(json_build_object('country', p.country, 'currency', p.currency, 'amount', p.amount, 'cost', p.cost) order by p.country)
                   from product_prices p where p.product_id = pr.id), '[]'::json) as prices`;

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    kind: row.kind as ProductKind,
    status: row.status as ProductStatus,
    prices: (row.prices ?? []).map((price): ProductPrice => ({
      country: price.country.trim(),
      currency: price.currency.trim(),
      amount: Number(price.amount),
      cost: price.cost === null || price.cost === undefined ? null : Number(price.cost)
    })),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

export class SqlProductRepository implements ProductRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<ReadonlyArray<ProductRecord>> {
    const result = await this.sql.query<ProductRow>(
      `select pr.*, ${PRICES},
              (select count(*) from sales s where s.tenant_id = pr.tenant_id and s.product_id = pr.id and s.status = 'approved') as sales_count
         from products pr
        where pr.tenant_id = $1
        order by pr.status asc, lower(pr.name) asc`,
      [tenantId]
    );
    return result.rows.map((row) => ({ ...toProduct(row), salesCount: Number(row.sales_count ?? 0) }));
  }

  public async find(tenantId: string, productId: string): Promise<Product | null> {
    const result = await this.sql.query<ProductRow>(`select pr.*, ${PRICES} from products pr where pr.tenant_id = $1 and pr.id = $2`, [tenantId, productId]);
    return result.rows[0] ? toProduct(result.rows[0]) : null;
  }

  public async count(tenantId: string): Promise<number> {
    const result = await this.sql.query<{ total: string }>(`select count(*) as total from products where tenant_id = $1`, [tenantId]);
    return Number(result.rows[0]?.total ?? 0);
  }

  public async nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean> {
    const result = await this.sql.query<{ id: string }>(
      `select id from products where tenant_id = $1 and lower(name) = lower($2) and ($3::uuid is null or id <> $3::uuid) limit 1`,
      [tenantId, name, exceptId ?? null]
    );
    return result.rows.length > 0;
  }

  public async create(tenantId: string, draft: ProductDraft): Promise<Product> {
    return this.sql.transaction(async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        `insert into products (tenant_id, name, description, kind, status) values ($1, $2, $3, $4, $5) returning id`,
        [tenantId, draft.name, draft.description, draft.kind, draft.status]
      );
      const id = inserted.rows[0]!.id;
      await writePrices(tx, tenantId, id, draft.prices);
      return (await findWith(tx, tenantId, id))!;
    });
  }

  public async update(tenantId: string, productId: string, draft: ProductDraft): Promise<Product | null> {
    return this.sql.transaction(async (tx) => {
      const updated = await tx.query<{ id: string }>(
        `update products set name = $3, description = $4, kind = $5, status = $6, updated_at = now()
          where tenant_id = $1 and id = $2 returning id`,
        [tenantId, productId, draft.name, draft.description, draft.kind, draft.status]
      );
      if (updated.rows.length === 0) return null;
      await tx.query(`delete from product_prices where tenant_id = $1 and product_id = $2`, [tenantId, productId]);
      await writePrices(tx, tenantId, productId, draft.prices);
      return findWith(tx, tenantId, productId);
    });
  }
}

async function writePrices(tx: SqlExecutor, tenantId: string, productId: string, prices: ReadonlyArray<ProductPrice>): Promise<void> {
  if (prices.length === 0) return;
  await tx.query(
    `insert into product_prices (product_id, tenant_id, country, currency, amount, cost)
     select $1, $2, p.country, p.currency, p.amount, p.cost
       from unnest($3::text[], $4::text[], $5::numeric[], $6::numeric[]) as p(country, currency, amount, cost)`,
    [productId, tenantId, prices.map((p) => p.country), prices.map((p) => p.currency), prices.map((p) => p.amount), prices.map((p) => p.cost ?? null)]
  );
}

async function findWith(tx: SqlExecutor, tenantId: string, productId: string): Promise<Product | null> {
  const result = await tx.query<ProductRow>(`select pr.*, ${PRICES} from products pr where pr.tenant_id = $1 and pr.id = $2`, [tenantId, productId]);
  return result.rows[0] ? toProduct(result.rows[0]) : null;
}
