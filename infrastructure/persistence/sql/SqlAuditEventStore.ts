import type { AuditEvent } from "../../../platform/observability/audit/AuditEvent";
import type { AuditEventStore } from "../../../platform/observability/audit/AuditEventStore";
import type { SqlClient } from "./SqlClient";
import { isUuid, toIso } from "./sqlValues";

// La auditoría en PostgreSQL (`056_audit_events.sql`). Solo agrega; por cuenta.

interface Row {
  id: string;
  tenant_id: string;
  type: AuditEvent["type"];
  actor_id: string;
  request_id: string;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

const MAX = 500;

const toEvent = (row: Row): AuditEvent => ({
  id: row.id,
  type: row.type,
  tenantId: row.tenant_id,
  actorId: row.actor_id,
  requestId: row.request_id,
  timestamp: toIso(row.created_at),
  metadata: row.metadata
});

export class SqlAuditEventStore implements AuditEventStore {
  public constructor(private readonly sql: SqlClient) {}

  public async append(event: AuditEvent): Promise<void> {
    await this.sql.query(
      "insert into audit_events (id, tenant_id, type, actor_id, request_id, metadata, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7)",
      [event.id, event.tenantId, event.type, event.actorId, event.requestId, JSON.stringify(event.metadata), event.timestamp]
    );
  }

  public async findByTenant(tenantId: string, limit = 100): Promise<ReadonlyArray<AuditEvent>> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>("select * from audit_events where tenant_id = $1 order by created_at desc, id limit $2", [tenantId, Math.min(limit, MAX)]);
    return result.rows.map(toEvent);
  }

  public async findByType(tenantId: string, type: AuditEvent["type"], limit = 100): Promise<ReadonlyArray<AuditEvent>> {
    if (!isUuid(tenantId)) return [];
    const result = await this.sql.query<Row>("select * from audit_events where tenant_id = $1 and type = $2 order by created_at desc, id limit $3", [tenantId, type, Math.min(limit, MAX)]);
    return result.rows.map(toEvent);
  }
}
