import { randomUUID } from "node:crypto";
import type { AuditEventStore } from "./AuditEventStore";
import type { AuditEvent } from "./AuditEvent";

type AuditEventInput = Omit<AuditEvent, "id" | "timestamp">;

// Responsabilidad única: registrar eventos de auditoría con id y timestamp generados.
// No persiste — delega al store.
export class AuditLogger {
  public constructor(private readonly store: AuditEventStore) {}

  public record(input: AuditEventInput): void {
    const event: AuditEvent = {
      ...input,
      id: randomUUID(),
      timestamp: new Date().toISOString()
    };
    this.store.append(event);
  }

  public recordPublish(tenantId: string, actorId: string, requestId: string, flowKey: string): void {
    this.record({ type: "flow.published", tenantId, actorId, requestId, metadata: { flowKey } });
  }

  public recordRollback(tenantId: string, actorId: string, requestId: string, flowKey: string): void {
    this.record({ type: "flow.rolled_back", tenantId, actorId, requestId, metadata: { flowKey } });
  }

  public recordAuthFailed(tenantId: string, actorId: string, requestId: string, reason: string): void {
    this.record({ type: "auth.failed", tenantId, actorId, requestId, metadata: { reason } });
  }

  public recordAccessDenied(tenantId: string, actorId: string, requestId: string, scope: string, reason: string): void {
    this.record({ type: "access.denied", tenantId, actorId, requestId, metadata: { scope, reason } });
  }
}
