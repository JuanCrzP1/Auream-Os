import type { AuditEventType } from "../contracts/AuditEventType";

// Evento de auditoría inmutable. Una vez registrado, nunca se modifica.
export interface AuditEvent {
  readonly id: string;
  readonly type: AuditEventType;
  readonly tenantId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
