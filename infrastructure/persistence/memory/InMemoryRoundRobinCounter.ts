import type { RoundRobinCounter } from "../../../flow-engine/ports/RoundRobinCounter";

/**
 * Turnos en memoria: para la simulación del builder (probar no debe mover los
 * turnos reales) y para pruebas. Atómico dentro del proceso (JavaScript es
 * monohilo); no se comparte entre procesos ni sobrevive al reinicio.
 */
export class InMemoryRoundRobinCounter implements RoundRobinCounter {
  private readonly values = new Map<string, number>();

  public async next(tenantId: string, key: string): Promise<number> {
    const id = `${tenantId}:${key}`;
    const turn = this.values.get(id) ?? 0;
    this.values.set(id, turn + 1);
    return turn;
  }
}
