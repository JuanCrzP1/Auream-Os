import type { BroadcastText, QuickReplyText } from "../../../domains/business-data/domain/businessDataUses";
import type { SqlExecutor } from "./SqlClient";
import { toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Los textos donde puede aparecer un dato del negocio, fuera de los flujos:
// las difusiones que aún se van a enviar (sus variantes y su seguimiento) y
// las respuestas rápidas (texto y pies de foto). Solo lectura, por cuenta.
// ---------------------------------------------------------------------------

/** Las que todavía mandan mensajes: una terminada o cancelada ya no usa el dato. */
const PENDING = ["scheduled", "sending", "testing", "paused", "auto_paused"];
const MAX_DEPTH = 5;

/** Los `text` y `caption` de un JSON (variantes, seguimiento, piezas). */
function textsIn(value: unknown, depth = 0, found: string[] = []): string[] {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) textsIn(item, depth + 1, found);
    return found;
  }
  for (const [key, item] of Object.entries(value)) {
    if ((key === "text" || key === "caption") && typeof item === "string") found.push(item);
    else textsIn(item, depth + 1, found);
  }
  return found;
}

export class SqlBusinessDataTexts {
  public constructor(private readonly sql: SqlExecutor) {}

  public async broadcasts(tenantId: string): Promise<ReadonlyArray<BroadcastText>> {
    const { rows } = await this.sql.query<{ id: string; name: string; status: string; scheduled_at: Date | string | null; variants: unknown; follow_up: unknown }>(
      `select id, name, status, scheduled_at, variants, follow_up from broadcasts where tenant_id = $1 and status = any($2::text[]) order by created_at desc limit 200`,
      [tenantId, PENDING]
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      // Solo una programada tiene hora de salida; las demás ya salen o esperan.
      sendAt: row.status === "scheduled" && row.scheduled_at !== null ? toIso(row.scheduled_at) : null,
      texts: textsIn([row.variants, row.follow_up])
    }));
  }

  public async quickReplies(tenantId: string): Promise<ReadonlyArray<QuickReplyText>> {
    const { rows } = await this.sql.query<{ id: string; shortcut: string; pieces: unknown }>(
      `select id, shortcut, pieces from quick_replies where tenant_id = $1 order by shortcut limit 500`,
      [tenantId]
    );
    return rows.map((row) => ({ id: row.id, shortcut: row.shortcut, texts: textsIn(row.pieces) }));
  }
}
