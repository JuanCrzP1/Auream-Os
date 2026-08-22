import type { Span } from "./Span";

// Interfaz de tracer. Compatible con OpenTelemetry SDK en el futuro.
export interface Tracer {
  startSpan(name: string, parentSpan?: Span): Span;
}
