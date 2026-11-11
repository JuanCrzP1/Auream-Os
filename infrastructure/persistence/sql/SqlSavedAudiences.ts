import type { AudienceFilter } from "../../../contracts/BroadcastContracts";
import type { SavedAudience } from "../../../contracts/BroadcastResultsContracts";
import type { SavedAudienceRepository } from "../../../domains/broadcasts/application/BroadcastPorts";
import type { SqlClient } from "./SqlClient";

// SqlSavedAudiences — `broadcast_audiences` (034): filtros con nombre para repetir difusiones.

interface Row {
  readonly id: string;
  readonly name: string;
  readonly audience: AudienceFilter;
  readonly created_at: Date;
}

export class SqlSavedAudiences implements SavedAudienceRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<ReadonlyArray<SavedAudience>> {
    const result = await this.sql.query<Row>("select id, name, audience, created_at from broadcast_audiences where tenant_id = $1 order by lower(name)", [tenantId]);
    return result.rows.map((row) => ({ id: row.id, name: row.name, audience: row.audience, createdAt: new Date(row.created_at).toISOString() }));
  }

  public async save(tenantId: string, audience: SavedAudience): Promise<void> {
    await this.sql.query("insert into broadcast_audiences (id, tenant_id, name, audience, created_at) values ($1, $2, $3, $4::jsonb, $5)", [
      audience.id,
      tenantId,
      audience.name,
      JSON.stringify(audience.audience),
      audience.createdAt
    ]);
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    const result = await this.sql.query("delete from broadcast_audiences where tenant_id = $1 and id = $2", [tenantId, id]);
    return (result.rowCount ?? 0) > 0;
  }
}
