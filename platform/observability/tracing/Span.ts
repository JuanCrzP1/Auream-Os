// Contrato mínimo para un span de tracing distribuido.
// Compatible con el modelo de OpenTelemetry (future migration path).
export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  setAttribute(key: string, value: string | number | boolean): void;
  end(endTimeMs?: number): void;
}
