import type { RuntimeInput } from "../../contracts/RuntimeContracts";

// ---------------------------------------------------------------------------
// ¿Desde cuándo cuenta una espera que declara un bloque? Desde que el cliente
// ve el último mensaje, no desde que empezó el turno: las pausas
// («escribiendo…») que pusieron los bloques anteriores del mismo turno corren
// antes. Lo usan el Intervalo (Programador) y el tiempo máximo de Esperar
// respuesta y del Menú. Pura.
// ---------------------------------------------------------------------------

/** `from` (ms) más las pausas que ya puso el turno. */
export function waitStartsAt(from: number, input: Pick<RuntimeInput, "inlinePauseUsedMs">): number {
  return from + Math.max(0, input.inlinePauseUsedMs ?? 0);
}
