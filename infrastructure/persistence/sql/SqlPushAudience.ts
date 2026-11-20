import type { PushAudience, TeamMember } from "../../../domains/notifications/application/PushPorts";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// ---------------------------------------------------------------------------
// Lo que un aviso del celular necesita leer de cada módulo: quién está en la
// empresa, quién atiende un chat, el nombre de un número y un seguimiento.
// Todo por empresa: nunca se lee nada de otra.
// ---------------------------------------------------------------------------

const PEOPLE_ROLES = ["tenant_owner", "tenant_admin", "operator", "viewer"];

export class SqlPushAudience implements PushAudience {
  public constructor(private readonly sql: SqlClient) {}

  public async members(tenantId: string): Promise<ReadonlyArray<TeamMember>> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<{ user_id: string; role: string }>(
      "select user_id, role from memberships where tenant_id = $1 and status = 'active' and role = any($2::text[])",
      [tenantId, PEOPLE_ROLES]
    );
    return result.rows.map((row) => ({ userId: row.user_id, role: row.role }));
  }

  public async chatAttendant(tenantId: string, connectionId: string, phone: string) {
    if (!isUuid(tenantId) || !isUuid(connectionId)) return null;
    const result = await this.sql.query<{ id: string; assignee_id: string; name: string | null }>(
      `select c.id, c.assignee_id, ct.name
         from conversations c left join contacts ct on ct.tenant_id = c.tenant_id and ct.id = c.contact_id
        where c.tenant_id = $1 and c.connection_id = $2 and c.phone = $3 and c.status = 'attending' and c.assignee_id is not null`,
      [tenantId, connectionId, phone]
    );
    const row = result.rows[0];
    return row ? { conversationId: row.id, assigneeId: row.assignee_id, contactName: row.name } : null;
  }

  public async connectionName(tenantId: string, connectionId: string): Promise<string | null> {
    if (!isUuid(tenantId) || !isUuid(connectionId)) return null;
    const result = await this.sql.query<{ name: string }>("select name from whatsapp_connections where tenant_id = $1 and id = $2", [tenantId, connectionId]);
    return result.rows[0]?.name ?? null;
  }

  public async followUp(tenantId: string, followUpId: string) {
    if (!isUuid(tenantId) || !isUuid(followUpId)) return null;
    const result = await this.sql.query<{ title: string; name: string | null; assignee_id: string | null; due_at: Date | string; done_at: Date | string | null }>(
      `select f.title, ct.name, f.assignee_id, f.due_at, f.done_at
         from crm_follow_ups f left join contacts ct on ct.tenant_id = f.tenant_id and ct.id = f.contact_id
        where f.tenant_id = $1 and f.id = $2`,
      [tenantId, followUpId]
    );
    const row = result.rows[0];
    return row ? { title: row.title, contactName: row.name, assigneeId: row.assignee_id, dueAt: toIso(row.due_at), doneAt: row.done_at === null ? null : toIso(row.done_at) } : null;
  }
}
