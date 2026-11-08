import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository";
import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow";
import type { AutomationStatus } from "../../../contracts/AutomationContracts";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// SqlAutomationRepository — el catálogo de automatizaciones en PostgreSQL.
//
// Misma interfaz que JsonAutomationRepository: los casos de uso no cambian.
// Toda consulta filtra por `tenant_id`: lo de otro tenant no se encuentra.
// ---------------------------------------------------------------------------

interface AutomationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly key: string;
  readonly name: string;
  readonly status: string;
  readonly folder_id: string | null;
  readonly tags: string[];
  readonly created_by: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const COLUMNS = "id, tenant_id, key, name, status, folder_id, tags, created_by, created_at, updated_at";

function toFlow(row: AutomationRow): AutomationFlow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    key: row.key,
    name: row.name,
    status: row.status as AutomationStatus,
    ...(row.folder_id !== null ? { folderId: row.folder_id } : {}),
    metadata: {
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      ...(row.created_by !== null ? { createdBy: row.created_by } : {}),
      ...(row.tags.length > 0 ? { tags: row.tags } : {})
    }
  };
}

export class SqlAutomationRepository implements AutomationRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findByTenant(tenantId: string): Promise<AutomationFlow[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<AutomationRow>(
      `select ${COLUMNS} from automations where tenant_id = $1 order by updated_at desc`,
      [tenantId]
    );
    return result.rows.map(toFlow);
  }

  public async findById(tenantId: string, id: string): Promise<AutomationFlow | undefined> {
    if (!isUuid(tenantId) || !isUuid(id)) return undefined;
    const result = await this.sql.query<AutomationRow>(
      `select ${COLUMNS} from automations where tenant_id = $1 and id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? toFlow(result.rows[0]) : undefined;
  }

  /** Inserta o actualiza. Una fila de otro tenant con el mismo id no se toca. */
  public async save(flow: AutomationFlow): Promise<void> {
    const result = await this.sql.query(
      `insert into automations (${COLUMNS})
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set
         key = excluded.key,
         name = excluded.name,
         status = excluded.status,
         folder_id = excluded.folder_id,
         tags = excluded.tags,
         updated_at = excluded.updated_at
       where automations.tenant_id = excluded.tenant_id`,
      [
        flow.id,
        flow.tenantId,
        flow.key,
        flow.name,
        flow.status,
        flow.folderId ?? null,
        flow.metadata.tags ?? [],
        flow.metadata.createdBy ?? null,
        flow.metadata.createdAt,
        flow.metadata.updatedAt
      ]
    );
    if (result.rowCount === 0) {
      throw new Error(`La automatización ${flow.id} pertenece a otro tenant.`);
    }
  }

  public async delete(tenantId: string, id: string): Promise<void> {
    if (!isUuid(tenantId) || !isUuid(id)) return;
    await this.sql.query("delete from automations where tenant_id = $1 and id = $2", [tenantId, id]);
  }
}
