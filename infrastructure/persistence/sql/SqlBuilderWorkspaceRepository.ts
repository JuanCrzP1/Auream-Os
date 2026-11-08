import type { BuilderWorkspaceRepository } from "../../../domains/automations/builder/application/BuilderWorkspaceRepository";
import type { PersistedBuilderWorkspace } from "../../../contracts/BuilderContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// SqlBuilderWorkspaceRepository — el borrador de cada flujo en PostgreSQL.
//
// Un documento por flujo (`automation_drafts.snapshot`, jsonb). Cuelga de su
// automatización: guardar el borrador de una que no existe falla por la FK,
// y borrar la automatización borra su borrador (cascada).
// ---------------------------------------------------------------------------

interface DraftRow {
  readonly tenant_id: string;
  readonly flow_key: string;
  readonly snapshot: BuilderFlowSnapshot;
  readonly revision: number;
  readonly updated_at: Date;
}

const COLUMNS = "tenant_id, flow_key, snapshot, revision, updated_at";

function toWorkspace(row: DraftRow): PersistedBuilderWorkspace {
  return {
    tenantId: row.tenant_id,
    flowKey: row.flow_key,
    draft: row.snapshot,
    updatedAt: toIso(row.updated_at),
    autosaveRevision: row.revision
  };
}

export class SqlBuilderWorkspaceRepository implements BuilderWorkspaceRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async getWorkspace(tenantId: string, flowKey: string): Promise<PersistedBuilderWorkspace | null> {
    if (!isUuid(tenantId)) return null;
    const result = await this.sql.query<DraftRow>(
      `select ${COLUMNS} from automation_drafts where tenant_id = $1 and flow_key = $2`,
      [tenantId, flowKey]
    );
    return result.rows[0] ? toWorkspace(result.rows[0]) : null;
  }

  public async getWorkspaces(tenantId: string, flowKeys: readonly string[]): Promise<PersistedBuilderWorkspace[]> {
    if (!isUuid(tenantId) || flowKeys.length === 0) return [];
    const result = await this.sql.query<DraftRow>(
      `select ${COLUMNS} from automation_drafts where tenant_id = $1 and flow_key = any($2::text[])`,
      [tenantId, flowKeys]
    );
    return result.rows.map(toWorkspace);
  }

  public async saveWorkspace(workspace: PersistedBuilderWorkspace): Promise<void> {
    await this.sql.query(
      `insert into automation_drafts (${COLUMNS})
       values ($1, $2, $3::jsonb, $4, $5)
       on conflict (tenant_id, flow_key) do update set
         snapshot = excluded.snapshot,
         revision = excluded.revision,
         updated_at = excluded.updated_at`,
      [workspace.tenantId, workspace.flowKey, JSON.stringify(workspace.draft), workspace.autosaveRevision, workspace.updatedAt]
    );
  }

  public async deleteWorkspace(tenantId: string, flowKey: string): Promise<void> {
    if (!isUuid(tenantId)) return;
    await this.sql.query("delete from automation_drafts where tenant_id = $1 and flow_key = $2", [tenantId, flowKey]);
  }
}
