// Interfaz mínima para colección de métricas.
// Diseñada para ser compatible con StatsD, Prometheus (push gateway) y DataDog.
export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
}
