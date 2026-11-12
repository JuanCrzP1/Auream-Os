import type { SalesLineRepository } from "../../../domains/sales-lines/application/SalesLineRepository";
import type { SalesLine, SalesLineDraft } from "../../../domains/sales-lines/domain/SalesLine";
import { ConflictError } from "../../../platform/observability/errors/ConflictError";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Líneas de venta en PostgreSQL (`043_sales_lines.sql`). Todo filtra por
// cuenta. El nombre es único sin importar mayúsculas (índice): si dos pedidos
// chocan, el segundo recibe el mismo `ConflictError` que la validación.
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  product_ids: string[];
  connection_ids: string[];
  campaign_ids: string[];
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, tenant_id, name, color, product_ids, connection_ids, campaign_ids, created_at, updated_at";

const toLine = (row: Row): SalesLine => ({
  id: row.id,
  tenantId: row.tenant_id,
  name: row.name,
  color: row.color,
  productIds: row.product_ids,
  connectionIds: row.connection_ids,
  campaignIds: row.campaign_ids,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

function conflict(error: unknown, name: string): never {
  if ((error as { code?: string } | null)?.code === "23505") throw new ConflictError(`Ya tienes una línea llamada «${name}».`);
  throw error;
}

export class SqlSalesLineRepository implements SalesLineRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async list(tenantId: string): Promise<SalesLine[]> {
    if (!isUuid(tenantId)) return [];
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from sales_lines where tenant_id = $1 order by lower(name)`, [tenantId]);
    return rows.map(toLine);
  }

  public async find(tenantId: string, id: string): Promise<SalesLine | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const { rows } = await this.sql.query<Row>(`select ${COLUMNS} from sales_lines where tenant_id = $1 and id = $2`, [tenantId, id]);
    return rows[0] ? toLine(rows[0]) : null;
  }

  public async count(tenantId: string): Promise<number> {
    const { rows } = await this.sql.query<{ n: string }>("select count(*) as n from sales_lines where tenant_id = $1", [tenantId]);
    return Number(rows[0]?.n ?? 0);
  }

  public async nameTaken(tenantId: string, name: string, exceptId?: string): Promise<boolean> {
    const { rows } = await this.sql.query(
      "select 1 from sales_lines where tenant_id = $1 and lower(btrim(name)) = lower(btrim($2)) and ($3::uuid is null or id <> $3::uuid) limit 1",
      [tenantId, name, exceptId ?? null]
    );
    return rows.length > 0;
  }

  public async create(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine> {
    try {
      const { rows } = await this.sql.query<Row>(
        `insert into sales_lines (id, tenant_id, name, color, product_ids, connection_ids, campaign_ids)
         values ($1, $2, $3, $4, $5::uuid[], $6::uuid[], $7::text[]) returning ${COLUMNS}`,
        [id, tenantId, draft.name, draft.color, [...draft.productIds], [...draft.connectionIds], [...draft.campaignIds]]
      );
      return toLine(rows[0]!);
    } catch (error) {
      return conflict(error, draft.name);
    }
  }

  public async update(tenantId: string, id: string, draft: SalesLineDraft): Promise<SalesLine | null> {
    try {
      const { rows } = await this.sql.query<Row>(
        `update sales_lines set name = $3, color = $4, product_ids = $5::uuid[], connection_ids = $6::uuid[], campaign_ids = $7::text[], updated_at = now()
          where tenant_id = $1 and id = $2 returning ${COLUMNS}`,
        [tenantId, id, draft.name, draft.color, [...draft.productIds], [...draft.connectionIds], [...draft.campaignIds]]
      );
      return rows[0] ? toLine(rows[0]) : null;
    } catch (error) {
      return conflict(error, draft.name);
    }
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from sales_lines where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }
}
