import type { FolderRepository } from "../../../domains/automations/catalog/application/FolderRepository";
import type { AutomationFolder } from "../../../domains/automations/catalog/domain/AutomationFolder";
import type { SqlExecutor } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// SqlFolderRepository — carpetas de automatizaciones en PostgreSQL.
// Misma interfaz que JsonFolderRepository; toda consulta filtra por tenant.
// ---------------------------------------------------------------------------

interface FolderRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly parent_folder_id: string | null;
  readonly created_at: Date;
}

const COLUMNS = "id, tenant_id, name, parent_folder_id, created_at";

function toFolder(row: FolderRow): AutomationFolder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    ...(row.parent_folder_id !== null ? { parentFolderId: row.parent_folder_id } : {}),
    createdAt: toIso(row.created_at)
  };
}

export class SqlFolderRepository implements FolderRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async findByTenant(tenantId: string): Promise<AutomationFolder[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<FolderRow>(
      `select ${COLUMNS} from automation_folders where tenant_id = $1 order by created_at`,
      [tenantId]
    );
    return result.rows.map(toFolder);
  }

  public async findById(tenantId: string, id: string): Promise<AutomationFolder | undefined> {
    if (!isUuid(tenantId) || !isUuid(id)) return undefined;
    const result = await this.sql.query<FolderRow>(
      `select ${COLUMNS} from automation_folders where tenant_id = $1 and id = $2`,
      [tenantId, id]
    );
    return result.rows[0] ? toFolder(result.rows[0]) : undefined;
  }

  /** Inserta o renombra. Una fila de otro tenant con el mismo id no se toca. */
  public async save(folder: AutomationFolder): Promise<void> {
    const result = await this.sql.query(
      `insert into automation_folders (${COLUMNS})
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set
         name = excluded.name,
         parent_folder_id = excluded.parent_folder_id,
         updated_at = now()
       where automation_folders.tenant_id = excluded.tenant_id`,
      [folder.id, folder.tenantId, folder.name, folder.parentFolderId ?? null, folder.createdAt]
    );
    if (result.rowCount === 0) {
      throw new Error(`La carpeta ${folder.id} pertenece a otro tenant.`);
    }
  }
}
