import type { FlowCatalog, FlowReference } from "../../../domains/connections/application/ports/FlowCatalog";
import type { SqlExecutor } from "./SqlClient";
import { isUuid } from "./sqlValues";

/** Nombre y estado de los flujos de una cuenta (tabla `automations`). */
export class SqlFlowCatalog implements FlowCatalog {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findMany(tenantId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<FlowReference>> {
    const valid = ids.filter(isUuid);
    if (!isUuid(tenantId) || valid.length === 0) return [];
    const result = await this.sql.query<{ id: string; key: string; name: string; status: string }>(
      "select id, key, name, status from automations where tenant_id = $1 and id = any($2::uuid[])",
      [tenantId, valid]
    );
    return result.rows.map((row) => ({ id: row.id, key: row.key, name: row.name, archived: row.status === "archived" }));
  }
}
