import type { AuditEvent } from "./AuditEvent";

// Interfaz del store de auditoría.
// Las implementaciones concretas viven en infrastructure/ (in-memory, SQL, almacenamiento externo).
export interface AuditEventStore {
  append(event: AuditEvent): void;
  findByTenant(tenantId: string, limit?: number): ReadonlyArray<AuditEvent>;
  findByType(tenantId: string, type: AuditEvent["type"], limit?: number): ReadonlyArray<AuditEvent>;
}
