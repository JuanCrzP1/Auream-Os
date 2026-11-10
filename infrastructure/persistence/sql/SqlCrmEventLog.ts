import type { CrmSource } from "../../../contracts/CrmActivityContracts";
import type { CrmEventInput, CrmEventLog, CrmEventRecord } from "../../../domains/crm/application/CrmRepositories";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlCrmEventLog — `crm_events` (032): el historial de cada cliente. Al leer
// suma el nombre de quien lo hizo y el de la automatización.
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly pipeline_id: string;
  readonly contact_id: string;
  readonly kind: CrmEventRecord["kind"];
  readonly from_stage_id: string | null;
  readonly to_stage_id: string | null;
  readonly source: string;
  readonly actor_id: string | null;
  readonly flow_key: string | null;
  readonly detail: string | null;
  readonly created_at: Date | string;
  readonly actor_name: string | null;
  readonly flow_name: string | null;
}

export class SqlCrmEventLog implements CrmEventLog {
  public constructor(private readonly sql: SqlExecutor) {}

  public async append(tenantId: string, event: CrmEventInput): Promise<void> {
    await this.sql.query(
      `insert into crm_events (tenant_id, pipeline_id, contact_id, kind, from_stage_id, to_stage_id, source, actor_id, flow_key, detail)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tenantId, event.pipelineId, event.contactId, event.kind, event.fromStageId, event.toStageId, event.source, event.actorId, event.flowKey, event.detail]
    );
  }

  public async forContact(tenantId: string, contactId: string, limit: number): Promise<ReadonlyArray<CrmEventRecord>> {
    const result = await this.sql.query<Row>(
      `select e.*, coalesce(u.display_name, u.email) as actor_name, a.name as flow_name
         from crm_events e
         left join user_profiles u on u.user_id = e.actor_id
         left join automations a on a.tenant_id = e.tenant_id and a.key = e.flow_key
        where e.tenant_id = $1 and e.contact_id = $2
        order by e.created_at desc, e.id desc
        limit $3`,
      [tenantId, contactId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      pipelineId: row.pipeline_id,
      contactId: row.contact_id,
      kind: row.kind,
      fromStageId: row.from_stage_id,
      toStageId: row.to_stage_id,
      source: row.source as CrmSource,
      actorId: row.actor_id,
      flowKey: row.flow_key,
      detail: row.detail,
      createdAt: (row.created_at instanceof Date ? row.created_at : new Date(row.created_at)).toISOString(),
      actorName: row.actor_name,
      flowName: row.flow_name
    }));
  }
}
