import type { MediaRepository } from "../../../domains/media/application/MediaRepository";
import type { MediaAsset } from "../../../domains/media/domain/MediaAsset";
import type { MediaKind } from "../../../contracts/MediaContracts";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

interface Row {
  id: string;
  tenant_id: string;
  kind: MediaKind;
  pathname: string;
  url: string;
  content_type: string;
  size_bytes: string | number;
  file_name: string;
  created_at: Date | string;
}

/** Medios en PostgreSQL (`008_media_assets.sql`). Todo filtra por cuenta. */
export class SqlMediaRepository implements MediaRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findById(tenantId: string, id: string): Promise<MediaAsset | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(
      "select id, tenant_id, kind, pathname, url, content_type, size_bytes, file_name, created_at from media_assets where tenant_id = $1 and id = $2",
      [tenantId, id]
    );
    const row = result.rows[0];
    return row
      ? { id: row.id, tenantId: row.tenant_id, kind: row.kind, pathname: row.pathname, url: row.url, contentType: row.content_type, size: Number(row.size_bytes), fileName: row.file_name, createdAt: toIso(row.created_at) }
      : null;
  }

  public async save(asset: MediaAsset): Promise<void> {
    await this.sql.query(
      `insert into media_assets (id, tenant_id, kind, pathname, url, content_type, size_bytes, file_name, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (id) do nothing`,
      [asset.id, asset.tenantId, asset.kind, asset.pathname, asset.url, asset.contentType, asset.size, asset.fileName, asset.createdAt]
    );
  }
}
