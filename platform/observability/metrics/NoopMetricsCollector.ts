import type { MetricsCollector } from "./MetricsCollector";

// Implementación vacía — útil para tests y entornos sin métricas configuradas.
// Reemplazar en producción por un colector real (Prometheus, Datadog, etc.).
export class NoopMetricsCollector implements MetricsCollector {
  public increment(_metric: string, _value?: number, _tags?: Record<string, string>): void {}
  public gauge(_metric: string, _value: number, _tags?: Record<string, string>): void {}
  public histogram(_metric: string, _value: number, _tags?: Record<string, string>): void {}
}
