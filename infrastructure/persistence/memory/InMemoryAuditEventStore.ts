import type { AuditEvent } from "../../../platform/observability/audit/AuditEvent";
import type { AuditEventStore } from "../../../platform/observability/audit/AuditEventStore";

export class InMemoryAuditEventStore implements AuditEventStore {
  private readonly store = new Map<string, AuditEvent[]>();

  public append(event: AuditEvent): void {
    const events = this.store.get(event.tenantId) ?? [];
    events.push(event);
    this.store.set(event.tenantId, events);
  }

  public findByTenant(tenantId: string, limit = 100): ReadonlyArray<AuditEvent> {
    const events = this.store.get(tenantId) ?? [];
    return events.slice(-limit);
  }

  public findByType(
    tenantId: string,
    type: AuditEvent["type"],
    limit = 100
  ): ReadonlyArray<AuditEvent> {
    const events = this.store.get(tenantId) ?? [];
    return events.filter((e) => e.type === type).slice(-limit);
  }
}

