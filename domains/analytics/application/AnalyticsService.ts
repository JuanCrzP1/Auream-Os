// ---------------------------------------------------------------------------
// AnalyticsService
//
// Acumula eventos de ejecución con un límite de capacidad.
// Cuando se supera MAX_EVENTS se descarta el evento más antiguo (ring buffer).
//
// Preparado para Redis/queue: en producción, track() publicaría a un stream
// (Redis Streams, BullMQ, Kafka) en vez de acumular in-memory.
// getEvents() se eliminaría en favor de un consumer del stream.
// ---------------------------------------------------------------------------

export interface AnalyticsRecord {
  readonly eventName: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class AnalyticsService {
  private readonly events: AnalyticsRecord[] = [];
  private static readonly MAX_EVENTS = 10_000;

  public track(eventName: string, payload: Record<string, unknown>): void {
    if (this.events.length >= AnalyticsService.MAX_EVENTS) {
      this.events.shift();
    }
    this.events.push({ eventName, payload });
  }

  public getEvents(): ReadonlyArray<AnalyticsRecord> {
    return [...this.events];
  }
}