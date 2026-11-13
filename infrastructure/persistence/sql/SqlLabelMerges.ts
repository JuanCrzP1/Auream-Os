import type { LabelMerge } from "../../../contracts/LabelManagementContracts";
import type { LabelHolders, LabelMergeStore, LabelReferenceRewriter, NewLabelMerge } from "../../../domains/labels/application/LabelManagementPorts";
import { labelKey } from "../../../domains/contacts/domain/Label";
import type { LabelRename } from "../../../domains/labels/domain/flowLabels";
import type { SqlClient, SqlExecutor } from "./SqlClient";
import { toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Unir etiquetas en PostgreSQL: el registro de cada unión (`label_merges`),
// los clientes de una etiqueta, y cambiarla en lo que la guarda o la nombra
// fuera de los flujos: el público de las difusiones por enviar y de los
// públicos guardados (por id) y los webhooks (por nombre). Por cuenta.
// ---------------------------------------------------------------------------

interface MergeRow {
  readonly id: string;
  readonly from_label_id: string;
  readonly from_name: string;
  readonly into_label_id: string;
  readonly into_name: string;
  readonly total: number;
  readonly moved: number;
  readonly status: LabelMerge["status"];
  readonly error: string | null;
  readonly created_at: Date | string;
}

const toMerge = (row: MergeRow): LabelMerge & { readonly fromId: string } => ({
  id: row.id,
  fromId: row.from_label_id,
  fromName: row.from_name,
  intoId: row.into_label_id,
  intoName: row.into_name,
  total: row.total,
  moved: Math.min(row.moved, row.total),
  status: row.status,
  error: row.error,
  createdAt: toIso(row.created_at)
});

const COLUMNS = "id, from_label_id, from_name, into_label_id, into_name, total, moved, status, error, created_at";
const PENDING = ["scheduled", "sending", "testing", "paused", "auto_paused"];

/** El público con `from` cambiado por `into` en sus dos listas, sin repetir. */
const swapAudience = (column: string) => `jsonb_set(jsonb_set(${column},
  '{labelIds}', coalesce((select jsonb_agg(distinct case when value = $2 then $3 else value end) from jsonb_array_elements_text(coalesce(${column} -> 'labelIds', '[]'::jsonb))), '[]'::jsonb)),
  '{excludeLabelIds}', coalesce((select jsonb_agg(distinct case when value = $2 then $3 else value end) from jsonb_array_elements_text(coalesce(${column} -> 'excludeLabelIds', '[]'::jsonb))), '[]'::jsonb))`;
const holdsLabel = (column: string) => `(${column} -> 'labelIds' ? $2 or ${column} -> 'excludeLabelIds' ? $2)`;

export class SqlLabelMerges implements LabelMergeStore, LabelReferenceRewriter, Pick<LabelHolders, "holders"> {
  public constructor(private readonly sql: SqlClient) {}

  public async start(tenantId: string, merge: NewLabelMerge): Promise<LabelMerge | null> {
    const { rows } = await this.sql.query<MergeRow>(
      `insert into label_merges (id, tenant_id, from_label_id, from_name, into_label_id, into_name, total, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (tenant_id, from_label_id) where status = 'running' do nothing
       returning ${COLUMNS}`,
      [merge.id, tenantId, merge.from.id, merge.from.name, merge.into.id, merge.into.name, merge.total, merge.createdBy]
    );
    return rows[0] ? toMerge(rows[0]) : null;
  }

  public async find(tenantId: string, id: string): Promise<(LabelMerge & { readonly fromId: string }) | null> {
    const { rows } = await this.sql.query<MergeRow>(`select ${COLUMNS} from label_merges where tenant_id = $1 and id = $2`, [tenantId, id]);
    return rows[0] ? toMerge(rows[0]) : null;
  }

  public async recent(tenantId: string, since: Date): Promise<ReadonlyArray<LabelMerge>> {
    const { rows } = await this.sql.query<MergeRow>(
      `select ${COLUMNS} from label_merges where tenant_id = $1 and (status = 'running' or coalesce(finished_at, updated_at) >= $2) order by created_at desc limit 20`,
      [tenantId, since.toISOString()]
    );
    return rows.map((row) => {
      const { fromId: _from, ...merge } = toMerge(row);
      return merge;
    });
  }

  public async advance(tenantId: string, id: string, moved: number): Promise<void> {
    await this.sql.query(`update label_merges set moved = moved + $3, updated_at = now() where tenant_id = $1 and id = $2`, [tenantId, id, moved]);
  }

  public async finish(tenantId: string, id: string, status: "done" | "failed", error?: string): Promise<void> {
    await this.sql.query(`update label_merges set status = $3, error = $4, finished_at = now(), updated_at = now() where tenant_id = $1 and id = $2 and status = 'running'`, [
      tenantId,
      id,
      status,
      error ?? null
    ]);
  }

  public async holders(tenantId: string, labelId: string, limit: number): Promise<ReadonlyArray<string>> {
    const { rows } = await this.sql.query<{ contact_id: string }>(
      `select contact_id from contact_label_assignments where tenant_id = $1 and label_id = $2 order by contact_id limit $3`,
      [tenantId, labelId, limit]
    );
    return rows.map((row) => row.contact_id);
  }

  public async replace(tenantId: string, from: { id: string; name: string }, into: { id: string; name: string }): Promise<void> {
    await this.sql.transaction(async (tx) => {
      await tx.query(`update broadcasts set audience = ${swapAudience("audience")}, updated_at = now() where tenant_id = $1 and status = any($4::text[]) and ${holdsLabel("audience")}`, [
        tenantId,
        from.id,
        into.id,
        PENDING
      ]);
      await tx.query(`update broadcast_audiences set audience = ${swapAudience("audience")} where tenant_id = $1 and ${holdsLabel("audience")}`, [tenantId, from.id, into.id]);
      await this.renameInWebhooks(tx, tenantId, { from: [from.name], to: into.name });
    });
  }

  public async rename(tenantId: string, rename: LabelRename): Promise<void> {
    await this.renameInWebhooks(this.sql, tenantId, rename);
  }

  /** Los webhooks nombran la etiqueta en `addTags` y `removeTags`: se cambia el nombre, sin repetir. */
  private async renameInWebhooks(sql: SqlExecutor, tenantId: string, rename: LabelRename): Promise<void> {
    const keys = new Set(rename.from.map(labelKey));
    const swap = (value: unknown) => {
      const list = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      const next: string[] = [];
      for (const name of list.map((name) => (keys.has(labelKey(name)) ? rename.to : name))) if (!next.some((other) => labelKey(other) === labelKey(name))) next.push(name);
      return { next, changed: list.some((name) => keys.has(labelKey(name))) };
    };
    const { rows } = await sql.query<{ id: string; mapping: Record<string, unknown> }>(`select id, mapping from inbound_webhooks where tenant_id = $1`, [tenantId]);
    for (const row of rows) {
      const add = swap(row.mapping["addTags"]);
      const remove = swap(row.mapping["removeTags"]);
      if (!add.changed && !remove.changed) continue;
      const mapping = { ...row.mapping, addTags: add.next, removeTags: remove.next };
      await sql.query(`update inbound_webhooks set mapping = $3::jsonb, updated_at = now() where tenant_id = $1 and id = $2`, [tenantId, row.id, JSON.stringify(mapping)]);
    }
  }
}
