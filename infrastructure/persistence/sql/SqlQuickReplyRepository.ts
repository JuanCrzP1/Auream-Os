import type { QuickReply, QuickReplyPiece } from "../../../contracts/QuickReplyContracts";
import type { NewQuickReply, QuickReplyChanges, QuickReplyRepository } from "../../../domains/quick-replies/application/QuickReplyRepository";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// Respuestas rápidas en PostgreSQL (`038_chat_tools.sql`, `039_quick_reply_categories.sql`). Todo filtra por cuenta.

interface Row {
  id: string;
  shortcut: string;
  category: string | null;
  pieces: QuickReplyPiece[];
  use_count: number;
  last_used_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = "id, shortcut, category, pieces, use_count, last_used_at, created_at, updated_at";

const toQuickReply = (row: Row): QuickReply => ({
  id: row.id,
  shortcut: row.shortcut,
  category: row.category,
  pieces: row.pieces,
  useCount: row.use_count,
  lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : null,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

export class SqlQuickReplyRepository implements QuickReplyRepository {
  public constructor(private readonly sql: SqlClient) {}

  public async list(tenantId: string): Promise<QuickReply[]> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>(
      `select ${COLUMNS} from quick_replies where tenant_id = $1 order by last_used_at desc nulls last, shortcut`,
      [tenantId]
    );
    return result.rows.map(toQuickReply);
  }

  public async count(tenantId: string): Promise<number> {
    if (!isUuid(tenantId)) return 0;
    const result = await this.sql.query<{ total: number }>("select count(*)::int as total from quick_replies where tenant_id = $1", [tenantId]);
    return result.rows[0]?.total ?? 0;
  }

  public async findByShortcut(tenantId: string, shortcut: string): Promise<QuickReply | null> {
    if (!isUuid(tenantId)) return null;
    const result = await this.sql.query<Row>(`select ${COLUMNS} from quick_replies where tenant_id = $1 and shortcut = $2`, [tenantId, shortcut]);
    return result.rows[0] ? toQuickReply(result.rows[0]) : null;
  }

  public async create(reply: NewQuickReply): Promise<QuickReply> {
    const result = await this.sql.query<Row>(
      `insert into quick_replies (id, tenant_id, shortcut, category, pieces, created_by) values ($1, $2, $3, $4, $5::jsonb, $6) returning ${COLUMNS}`,
      [reply.id, reply.tenantId, reply.shortcut, reply.category, JSON.stringify(reply.pieces), reply.createdBy]
    );
    return toQuickReply(result.rows[0]!);
  }

  public async update(tenantId: string, id: string, changes: QuickReplyChanges): Promise<QuickReply | null> {
    if (!isUuid(tenantId) || !isUuid(id)) return null;
    const result = await this.sql.query<Row>(
      `update quick_replies set shortcut = $3, category = $4, pieces = $5::jsonb, updated_at = now() where tenant_id = $1 and id = $2 returning ${COLUMNS}`,
      [tenantId, id, changes.shortcut, changes.category, JSON.stringify(changes.pieces)]
    );
    return result.rows[0] ? toQuickReply(result.rows[0]) : null;
  }

  public async remove(tenantId: string, id: string): Promise<boolean> {
    if (!isUuid(tenantId) || !isUuid(id)) return false;
    const result = await this.sql.query("delete from quick_replies where tenant_id = $1 and id = $2", [tenantId, id]);
    return result.rowCount > 0;
  }

  public async markUsed(tenantId: string, id: string): Promise<void> {
    if (!isUuid(tenantId) || !isUuid(id)) return;
    await this.sql.query("update quick_replies set use_count = use_count + 1, last_used_at = now() where tenant_id = $1 and id = $2", [tenantId, id]);
  }
}
