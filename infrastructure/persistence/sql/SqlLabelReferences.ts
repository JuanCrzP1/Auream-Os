import type { LabelSales, LabelUse } from "../../../contracts/LabelManagementContracts";
import type { LabelReferences } from "../../../domains/labels/application/LabelManagementPorts";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// Quién usa cada etiqueta fuera de los flujos, y lo que vendieron sus
// clientes. Solo lectura, por cuenta:
//
//   por id      la etapa de un embudo (`crm_stages`), las difusiones que aún
//               se van a enviar (su público) y los públicos guardados
//   por nombre  los webhooks (ponen o quitan) y las campañas de grupos que
//               ponen la etiqueta con su nombre
//   ventas      aprobadas desde una fecha, del cliente por su ficha o, si se
//               anotó a mano, por su teléfono
// ---------------------------------------------------------------------------

/** Las que todavía mandan mensajes. */
const PENDING = ["scheduled", "sending", "testing", "paused", "auto_paused"];

/** Los ids de etiqueta de un público (`labelIds` y `excludeLabelIds`). */
const AUDIENCE_LABELS = `(select array_agg(value) from (
  select jsonb_array_elements_text(coalesce(audience -> 'labelIds', '[]'::jsonb))
  union select jsonb_array_elements_text(coalesce(audience -> 'excludeLabelIds', '[]'::jsonb))) ids(value))`;

const names = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export class SqlLabelReferences implements LabelReferences {
  public constructor(private readonly sql: SqlExecutor) {}

  public async byId(tenantId: string): Promise<ReadonlyArray<{ readonly labelId: string; readonly use: LabelUse }>> {
    const [stages, broadcasts, audiences] = await Promise.all([
      this.sql.query<{ label_id: string; pipeline_id: string; pipeline_name: string }>(
        `select s.label_id, p.id as pipeline_id, p.name as pipeline_name
           from crm_stages s join crm_pipelines p on p.tenant_id = s.tenant_id and p.id = s.pipeline_id
          where s.tenant_id = $1`,
        [tenantId]
      ),
      this.sql.query<{ id: string; name: string; labels: string[] | null }>(
        `select id, name, ${AUDIENCE_LABELS} as labels from broadcasts where tenant_id = $1 and status = any($2::text[])`,
        [tenantId, PENDING]
      ),
      this.sql.query<{ id: string; name: string; labels: string[] | null }>(`select id, name, ${AUDIENCE_LABELS} as labels from broadcast_audiences where tenant_id = $1`, [tenantId])
    ]);
    return [
      ...stages.rows.map((row) => ({ labelId: row.label_id, use: { kind: "stage" as const, pipelineId: row.pipeline_id, pipelineName: row.pipeline_name } })),
      ...broadcasts.rows.flatMap((row) => (row.labels ?? []).map((labelId) => ({ labelId, use: { kind: "broadcast" as const, id: row.id, name: row.name } }))),
      ...audiences.rows.flatMap((row) => (row.labels ?? []).map((labelId) => ({ labelId, use: { kind: "audience" as const, id: row.id, name: row.name } })))
    ];
  }

  public async byName(tenantId: string): Promise<ReadonlyArray<{ readonly name: string; readonly use: LabelUse }>> {
    const [webhooks, campaigns] = await Promise.all([
      this.sql.query<{ id: string; name: string; mapping: Record<string, unknown> }>(`select id, name, mapping from inbound_webhooks where tenant_id = $1`, [tenantId]),
      this.sql.query<{ id: string; name: string }>(
        `select id, name from group_campaigns where tenant_id = $1 and status = 'active' and coalesce((rules ->> 'labelOnJoin')::boolean, true)`,
        [tenantId]
      )
    ]);
    return [
      ...webhooks.rows.flatMap((row) =>
        [...new Set([...names(row.mapping["addTags"]), ...names(row.mapping["removeTags"])])].map((name) => ({ name, use: { kind: "webhook" as const, id: row.id, name: row.name } }))
      ),
      ...campaigns.rows.map((row) => ({ name: row.name, use: { kind: "groupCampaign" as const, id: row.id, name: row.name } }))
    ];
  }

  public async sales(tenantId: string, since: Date): Promise<ReadonlyArray<LabelSales & { readonly labelId: string }>> {
    const { rows } = await this.sql.query<{ label_id: string; currency: string; amount: string; sales: string }>(
      `select a.label_id, s.currency, sum(s.amount) as amount, count(*) as sales
         from sales s
         cross join lateral (select coalesce(s.contact_id, (select c.id from contacts c where c.tenant_id = s.tenant_id and c.phone = s.customer_phone limit 1)) as id) buyer
         join contact_label_assignments a on a.tenant_id = s.tenant_id and a.contact_id = buyer.id
        where s.tenant_id = $1 and s.status = 'approved' and s.sold_at >= $2
        group by 1, 2`,
      [tenantId, since.toISOString()]
    );
    return rows.map((row) => ({ labelId: row.label_id, currency: row.currency.trim(), amount: Number(row.amount), sales: Number(row.sales) }));
  }
}
