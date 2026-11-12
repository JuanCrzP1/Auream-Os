import type { ImportCandidates } from "../../../domains/crm/application/ClientImport";
import type { SqlClient } from "./SqlClient";
import { isUuid } from "./sqlValues";

// Los clientes con chat que aún no están en un embudo (ninguna de sus
// etiquetas de etapa), por su última actividad. Todo filtra por cuenta.

const CANDIDATES = `
  from conversations c
 where c.tenant_id = $1 and c.contact_id is not null
   and ($3::timestamptz is null or coalesce(c.last_message_at, c.created_at) >= $3::timestamptz)
   and not exists (select 1 from contact_label_assignments la
                    where la.tenant_id = c.tenant_id and la.contact_id = c.contact_id and la.label_id = any($2::uuid[]))`;

export class SqlCrmImportCandidates implements ImportCandidates {
  public constructor(private readonly sql: SqlClient) {}

  public async count(tenantId: string, excludeLabelIds: ReadonlyArray<string>, since: Date | null): Promise<number> {
    if (!isUuid(tenantId)) return 0;
    const result = await this.sql.query<{ total: number }>(`select count(distinct c.contact_id)::int as total ${CANDIDATES}`, [tenantId, [...excludeLabelIds], since]);
    return result.rows[0]?.total ?? 0;
  }

  public async list(tenantId: string, excludeLabelIds: ReadonlyArray<string>, since: Date | null, limit: number): Promise<ReadonlyArray<string>> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<{ contact_id: string }>(
      `select c.contact_id ${CANDIDATES}
        group by c.contact_id
        order by max(coalesce(c.last_message_at, c.created_at)) desc
        limit $4`,
      [tenantId, [...excludeLabelIds], since, limit]
    );
    return result.rows.map((row) => row.contact_id);
  }
}
