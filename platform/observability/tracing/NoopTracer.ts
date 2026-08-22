import { randomUUID } from "node:crypto";
import type { Span } from "./Span";
import type { Tracer } from "./Tracer";

// Tracer vacío — no emite spans reales.
// Reemplazar en producción por OpenTelemetry SDK (@opentelemetry/sdk-node).
class NoopSpan implements Span {
  public readonly traceId = randomUUID();
  public readonly spanId = randomUUID();
  public constructor(public readonly name: string) {}
  public setAttribute(_key: string, _value: string | number | boolean): void {}
  public end(_endTimeMs?: number): void {}
}

export class NoopTracer implements Tracer {
  public startSpan(name: string, _parentSpan?: Span): Span {
    return new NoopSpan(name);
  }
}
