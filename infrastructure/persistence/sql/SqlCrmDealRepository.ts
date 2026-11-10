import type { DealChanges, DealEntry, DealRepository } from "../../../domains/crm/application/CrmRepositories";
import type { Deal } from "../../../domains/crm/domain/Deal";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlCrmDealRepository — `crm_deals` (032): el cliente en un embudo con su
// valor, su producto y su responsable. Entrar a una etapa nunca pisa el valor
// ni el responsable que ya tenía (solo los pone si faltan).
// ---------------------------------------------------------------------------

interface Row {
  readonly tenant_id: string;
  readonly pipeline_id: string;
  readonly contact_id: string;
  readonly stage_id: string | null;
  readonly stage_entered_at: Date | string;
  readonly won_at: Date | string | null;
  readonly amount: string | number | null;
  readonly currency: string | null;
  readonly product_id: string | null;
  readonly product_name: string | null;
  readonly owner_id: string | null;
  readonly owner_name?: string | null;
}

const iso = (value: Date | string) => (value instanceof Date ? value : new Date(value)).toISOString();

function toDeal(row: Row): Deal {
  return {
    tenantId: row.tenant_id,
    pipelineId: row.pipeline_id,
    contactId: row.contact_id,
    stageId: row.stage_id,
    stageEnteredAt: iso(row.stage_entered_at),
    wonAt: row.won_at === null ? null : iso(row.won_at),
    value: row.amount === null || row.currency === null ? null : { amount: Number(row.amount), currency: row.currency.trim() },
    productId: row.product_id,
    productName: row.product_name,
    ownerId: row.owner_id
  };
}

export class SqlCrmDealRepository implements DealRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async find(tenantId: string, pipelineId: string, contactId: string): Promise<Deal | null> {
    const result = await this.sql.query<Row>(`select * from crm_deals where tenant_id = $1 and pipeline_id = $2 and contact_id = $3`, [tenantId, pipelineId, contactId]);
    return result.rows[0] ? toDeal(result.rows[0]) : null;
  }

  public async forContact(tenantId: string, contactId: string) {
    const result = await this.sql.query<Row>(
      `select d.*, coalesce(u.display_name, u.email) as owner_name
         from crm_deals d left join user_profiles u on u.user_id = d.owner_id
        where d.tenant_id = $1 and d.contact_id = $2`,
      [tenantId, contactId]
    );
    return result.rows.map((row) => ({ ...toDeal(row), ownerName: row.owner_name ?? null }));
  }

  public async enter(tenantId: string, pipelineId: string, contactId: string, entry: DealEntry): Promise<Deal> {
    const result = await this.sql.query<Row>(
      `insert into crm_deals (tenant_id, pipeline_id, contact_id, stage_id, won_at, amount, currency, product_id, product_name, owner_id)
       values ($1, $2, $3, $4, case when $5::boolean then now() end, $6, $7, $8, $9, $10)
       on conflict (pipeline_id, contact_id) do update set
         stage_id = excluded.stage_id,
         stage_entered_at = case when crm_deals.stage_id is distinct from excluded.stage_id then now() else crm_deals.stage_entered_at end,
         won_at = coalesce(crm_deals.won_at, excluded.won_at),
         amount = coalesce(crm_deals.amount, excluded.amount),
         currency = case when crm_deals.amount is null then excluded.currency else crm_deals.currency end,
         product_name = case when crm_deals.product_id is null then excluded.product_name else crm_deals.product_name end,
         product_id = coalesce(crm_deals.product_id, excluded.product_id),
         owner_id = coalesce(crm_deals.owner_id, excluded.owner_id),
         updated_at = now()
        where crm_deals.tenant_id = excluded.tenant_id
       returning *`,
      [tenantId, pipelineId, contactId, entry.stageId, entry.won, entry.value?.amount ?? null, entry.value?.currency ?? null, entry.productId, entry.productName, entry.ownerId]
    );
    return toDeal(result.rows[0]!);
  }

  public async leave(tenantId: string, pipelineId: string, contactId: string): Promise<void> {
    await this.sql.query(`update crm_deals set stage_id = null, updated_at = now() where tenant_id = $1 and pipeline_id = $2 and contact_id = $3`, [tenantId, pipelineId, contactId]);
  }

  public async update(tenantId: string, pipelineId: string, contactId: string, changes: DealChanges): Promise<Deal> {
    const sets: string[] = [];
    const params: unknown[] = [tenantId, pipelineId, contactId];
    const set = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    if (changes.value !== undefined) {
      set("amount", changes.value?.amount ?? null);
      set("currency", changes.value?.currency ?? null);
    }
    if (changes.productId !== undefined) set("product_id", changes.productId);
    if (changes.productName !== undefined) set("product_name", changes.productName);
    if (changes.ownerId !== undefined) set("owner_id", changes.ownerId);
    const result = await this.sql.query<Row>(
      `update crm_deals set ${[...sets, "updated_at = now()"].join(", ")} where tenant_id = $1 and pipeline_id = $2 and contact_id = $3 returning *`,
      params
    );
    if (!result.rows[0]) throw new Error("El cliente no está en el embudo.");
    return toDeal(result.rows[0]);
  }
}
