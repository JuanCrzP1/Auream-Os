import type { StageOutcome } from "../../../contracts/CrmContracts";
import type { PipelineRecord, PipelineRepository } from "../../../domains/crm/application/CrmRepositories";
import type { Pipeline, Stage } from "../../../domains/crm/domain/Pipeline";
import type { SqlClient } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlCrmPipelineRepository — `crm_pipelines` y `crm_stages` (032). El nombre
// y el color de cada etapa son los de su etiqueta (`contact_labels`).
// ---------------------------------------------------------------------------

interface Row {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly entry_stage_id: string | null;
  readonly sale_stage_id: string | null;
  readonly default_product_id: string | null;
  readonly auto_assign: boolean;
  readonly stage_id: string | null;
  readonly label_id: string | null;
  readonly outcome: string | null;
  readonly position: number | null;
  readonly label_name: string | null;
  readonly label_color: string | null;
}

const SELECT = `select p.id, p.tenant_id, p.name, p.entry_stage_id, p.sale_stage_id, p.default_product_id, p.auto_assign,
                       s.id as stage_id, s.label_id, s.outcome, s.position, l.name as label_name, l.color as label_color
                  from crm_pipelines p
                  left join crm_stages s on s.tenant_id = p.tenant_id and s.pipeline_id = p.id
                  left join contact_labels l on l.tenant_id = s.tenant_id and l.id = s.label_id`;

function toPipelines(rows: ReadonlyArray<Row>): Pipeline[] {
  const byId = new Map<string, { pipeline: Omit<Pipeline, "stages">; stages: Stage[] }>();
  for (const row of rows) {
    const entry = byId.get(row.id) ?? {
      pipeline: {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        entryStageId: row.entry_stage_id,
        saleStageId: row.sale_stage_id,
        defaultProductId: row.default_product_id,
        autoAssign: row.auto_assign
      },
      stages: []
    };
    if (row.stage_id && row.label_id) {
      entry.stages.push({
        id: row.stage_id,
        pipelineId: row.id,
        labelId: row.label_id,
        name: row.label_name ?? "",
        color: row.label_color ?? "#64748b",
        outcome: row.outcome as StageOutcome,
        position: row.position ?? 0
      });
    }
    byId.set(row.id, entry);
  }
  return [...byId.values()].map(({ pipeline, stages }) => ({ ...pipeline, stages: stages.sort((a, b) => a.position - b.position) }));
}

export class SqlCrmPipelineRepository implements PipelineRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<ReadonlyArray<Pipeline>> {
    const result = await this.sql.query<Row>(`${SELECT} where p.tenant_id = $1 order by p.position, p.created_at, s.position`, [tenantId]);
    return toPipelines(result.rows);
  }

  public async find(tenantId: string, pipelineId: string): Promise<Pipeline | null> {
    const result = await this.sql.query<Row>(`${SELECT} where p.tenant_id = $1 and p.id = $2 order by s.position`, [tenantId, pipelineId]);
    return toPipelines(result.rows)[0] ?? null;
  }

  public async save(tenantId: string, pipeline: PipelineRecord): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query(
        `insert into crm_pipelines (id, tenant_id, name, position, default_product_id, auto_assign)
         values ($1, $2, $3, (select coalesce(max(position) + 1, 0) from crm_pipelines where tenant_id = $2), $4, $5)
         on conflict (id) do update set name = excluded.name, default_product_id = excluded.default_product_id,
                                        auto_assign = excluded.auto_assign, updated_at = now()
          where crm_pipelines.tenant_id = excluded.tenant_id`,
        [pipeline.id, tenantId, pipeline.name, pipeline.defaultProductId, pipeline.autoAssign]
      );
      const ids = pipeline.stages.map((stage) => stage.id);
      await tx.query(`delete from crm_stages where tenant_id = $1 and pipeline_id = $2 and not (id = any($3::uuid[]))`, [tenantId, pipeline.id, ids]);
      for (const [position, stage] of pipeline.stages.entries()) {
        await tx.query(
          `insert into crm_stages (id, tenant_id, pipeline_id, label_id, outcome, position)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (id) do update set outcome = excluded.outcome, position = excluded.position
            where crm_stages.tenant_id = excluded.tenant_id and crm_stages.pipeline_id = excluded.pipeline_id`,
          [stage.id, tenantId, pipeline.id, stage.labelId, stage.outcome, position]
        );
      }
      await tx.query(`update crm_pipelines set entry_stage_id = $3, sale_stage_id = $4 where tenant_id = $1 and id = $2`, [
        tenantId,
        pipeline.id,
        pipeline.entryStageId,
        pipeline.saleStageId
      ]);
    });
  }

  public async remove(tenantId: string, pipelineId: string): Promise<boolean> {
    const result = await this.sql.query(`delete from crm_pipelines where tenant_id = $1 and id = $2 returning id`, [tenantId, pipelineId]);
    return result.rows.length > 0;
  }

  public async stagesForLabels(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<Stage>> {
    if (labelIds.length === 0) return [];
    const result = await this.sql.query<{ id: string; pipeline_id: string; label_id: string; outcome: string; position: number; name: string; color: string }>(
      `select s.id, s.pipeline_id, s.label_id, s.outcome, s.position, l.name, l.color
         from crm_stages s join contact_labels l on l.tenant_id = s.tenant_id and l.id = s.label_id
        where s.tenant_id = $1 and s.label_id = any($2::uuid[])`,
      [tenantId, [...labelIds]]
    );
    return result.rows.map((row) => ({
      id: row.id,
      pipelineId: row.pipeline_id,
      labelId: row.label_id,
      name: row.name,
      color: row.color,
      outcome: row.outcome as StageOutcome,
      position: row.position
    }));
  }

  public async stageLabelGroups(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<string>>> {
    if (labelIds.length === 0) return [];
    const result = await this.sql.query<{ pipeline_id: string; label_ids: string[] }>(
      `select pipeline_id, array_agg(label_id::text order by position) as label_ids from crm_stages
        where tenant_id = $1 and pipeline_id in (select pipeline_id from crm_stages where tenant_id = $1 and label_id = any($2::uuid[]))
        group by pipeline_id`,
      [tenantId, [...labelIds]]
    );
    return result.rows.map((row) => row.label_ids);
  }

  public async pipelineUsingLabel(tenantId: string, labelId: string, except: string | null): Promise<string | null> {
    const result = await this.sql.query<{ name: string }>(
      `select p.name from crm_stages s join crm_pipelines p on p.tenant_id = s.tenant_id and p.id = s.pipeline_id
        where s.tenant_id = $1 and s.label_id = $2 and ($3::uuid is null or s.pipeline_id <> $3::uuid) limit 1`,
      [tenantId, labelId, except]
    );
    return result.rows[0]?.name ?? null;
  }
}
