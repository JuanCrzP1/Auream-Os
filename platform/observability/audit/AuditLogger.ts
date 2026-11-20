import { randomUUID } from "node:crypto";
import type { AuditEventStore } from "./AuditEventStore";
import type { AuditEvent } from "./AuditEvent";

type AuditEventInput = Omit<AuditEvent, "id" | "timestamp">;

/** Una descarga con datos de clientes: qué se bajó, de dónde y cuántas filas. */
export interface DataExportRecord {
  /** Qué se descargó («sales», «group_members»…). */
  readonly kind: string;
  /** De qué (el grupo, por ejemplo); `null` si es de toda la cuenta. */
  readonly subjectId: string | null;
  readonly rows: number;
  /** Con qué filtros (para saber exactamente qué salió). */
  readonly filters?: Readonly<Record<string, unknown>>;
}

// Responsabilidad única: registrar eventos de auditoría con id y fecha.
// No persiste — delega al store. Quien registra espera a que quede guardado:
// si no se pudo registrar, la acción no sigue (p. ej., no sale la descarga).
export class AuditLogger {
  public constructor(
    private readonly store: AuditEventStore,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID
  ) {}

  public record(input: AuditEventInput): Promise<void> {
    const event: AuditEvent = { ...input, id: this.newId(), timestamp: this.now().toISOString() };
    return this.store.append(event);
  }

  public recordPublish(tenantId: string, actorId: string, requestId: string, flowKey: string): Promise<void> {
    return this.record({ type: "flow.published", tenantId, actorId, requestId, metadata: { flowKey } });
  }

  public recordRollback(tenantId: string, actorId: string, requestId: string, flowKey: string): Promise<void> {
    return this.record({ type: "flow.rolled_back", tenantId, actorId, requestId, metadata: { flowKey } });
  }

  public recordAuthFailed(tenantId: string, actorId: string, requestId: string, reason: string): Promise<void> {
    return this.record({ type: "auth.failed", tenantId, actorId, requestId, metadata: { reason } });
  }

  public recordAccessDenied(tenantId: string, actorId: string, requestId: string, scope: string, reason: string): Promise<void> {
    return this.record({ type: "access.denied", tenantId, actorId, requestId, metadata: { scope, reason } });
  }

  public recordDataExport(tenantId: string, actorId: string, requestId: string, data: DataExportRecord): Promise<void> {
    return this.record({ type: "data.exported", tenantId, actorId, requestId, metadata: { kind: data.kind, subjectId: data.subjectId, rows: data.rows, ...(data.filters ? { filters: data.filters } : {}) } });
  }
}
