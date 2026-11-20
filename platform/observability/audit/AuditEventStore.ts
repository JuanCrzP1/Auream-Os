import type { AuditEvent } from "./AuditEvent";

// Interfaz del store de auditoría. Solo agrega: un evento nunca se cambia.
// Las implementaciones concretas viven en infrastructure/ (memoria para las
// pruebas, PostgreSQL en producción).
export interface AuditEventStore {
  append(event: AuditEvent): Promise<void>;
  /** Los más recientes primero. */
  findByTenant(tenantId: string, limit?: number): Promise<ReadonlyArray<AuditEvent>>;
  /** Los más recientes primero. */
  findByType(tenantId: string, type: AuditEvent["type"], limit?: number): Promise<ReadonlyArray<AuditEvent>>;
}
