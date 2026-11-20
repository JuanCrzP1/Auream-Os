import type { AuditEvent } from "../../../platform/observability/audit/AuditEvent";
import type { AuditEventStore } from "../../../platform/observability/audit/AuditEventStore";

/** Auditoría en memoria (pruebas). Los más recientes primero, como en PostgreSQL. */
export class InMemoryAuditEventStore implements AuditEventStore {
  private readonly store = new Map<string, AuditEvent[]>();

  public async append(event: AuditEvent): Promise<void> {
    const events = this.store.get(event.tenantId) ?? [];
    events.push(event);
    this.store.set(event.tenantId, events);
  }

  public async findByTenant(tenantId: string, limit = 100): Promise<ReadonlyArray<AuditEvent>> {
    return [...(this.store.get(tenantId) ?? [])].reverse().slice(0, limit);
  }

  public async findByType(tenantId: string, type: AuditEvent["type"], limit = 100): Promise<ReadonlyArray<AuditEvent>> {
    return [...(this.store.get(tenantId) ?? [])].reverse().filter((event) => event.type === type).slice(0, limit);
  }
}
