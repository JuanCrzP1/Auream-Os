import type { RoundRobinCounter } from "../../flow-engine/ports/RoundRobinCounter";

/** Turnos del Distribuidor durante una prueba: parten de los que trae el navegador y vuelven a él. */
export class SimulatedRoundRobinCounter implements RoundRobinCounter {
  private readonly counts: Map<string, number>;

  public constructor(seed: Readonly<Record<string, number>>) {
    this.counts = new Map(Object.entries(seed));
  }

  public async next(_tenantId: string, key: string): Promise<number> {
    const value = this.counts.get(key) ?? 0;
    this.counts.set(key, value + 1);
    return value;
  }

  public snapshot(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}
