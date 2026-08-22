// Entrada de log estructurado — campos obligatorios + extensible con [key: string].
export interface LogEntry {
  readonly level: "info" | "warn" | "error" | "debug";
  readonly message: string;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly tenantId?: string;
  readonly actorId?: string;
  readonly flowId?: string;
  readonly versionId?: string;
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}
