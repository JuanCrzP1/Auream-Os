import type { MetaDataDeletionStore } from "../../../domains/ads/application/MetaDataDeletionService";
import type { SqlClient } from "./SqlClient";
import { toIso } from "./sqlValues";

// Borrados de datos pedidos desde Meta (`047_meta_data_deletions.sql`) y las
// conexiones de Meta Ads que hizo cada persona de Meta (`meta_connections`).

export class SqlMetaDataDeletions implements MetaDataDeletionStore {
  public constructor(private readonly sql: SqlClient) {}

  public async tenantsConnectedBy(metaUserId: string): Promise<ReadonlyArray<string>> {
    const { rows } = await this.sql.query<{ tenant_id: string }>("select tenant_id from meta_connections where meta_user_id = $1", [metaUserId]);
    return rows.map((row) => row.tenant_id);
  }

  public async record(entry: { readonly code: string; readonly userHash: string; readonly deletedConnections: number; readonly requestedAt: Date }): Promise<void> {
    await this.sql.query(
      "insert into meta_data_deletions (code, user_hash, deleted_connections, requested_at) values ($1, $2, $3, $4)",
      [entry.code, entry.userHash, entry.deletedConnections, entry.requestedAt]
    );
  }

  public async find(code: string): Promise<{ readonly deletedConnections: number; readonly requestedAt: string } | null> {
    const { rows } = await this.sql.query<{ deleted_connections: number; requested_at: Date | string }>(
      "select deleted_connections, requested_at from meta_data_deletions where code = $1",
      [code]
    );
    const row = rows[0];
    return row ? { deletedConnections: row.deleted_connections, requestedAt: toIso(row.requested_at) } : null;
  }
}
