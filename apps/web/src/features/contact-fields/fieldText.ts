import type { FieldUse } from "@contracts/ContactFieldContracts";

// ---------------------------------------------------------------------------
// Cómo se cuenta un campo en pantalla: qué tan lleno está y quién lo usa. Los
// tipos y las opciones: `@shared/contact-fields/fieldTypes`. Puro.
// ---------------------------------------------------------------------------

/** Porcentaje entero de clientes con el dato (0 si no hay clientes). */
export function filledPercent(filled: number, total: number): number {
  if (total <= 0 || filled <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round((filled / total) * 100)));
}

export const count = (value: number) => value.toLocaleString("es-CO");

/** «1 cliente», «1.204 clientes». */
export const clients = (value: number) => (value === 1 ? "1 cliente" : `${count(value)} clientes`);

/** Un uso para leer: «¿Ciudad?» de «Ventas». */
export const useLabel = (use: FieldUse) => `«${use.blockName}» de «${use.flowName}»`;

/** Resumen de la columna «Lo usan»: un bloque, los de un flujo o cuántos flujos. */
export function usesSummary(uses: ReadonlyArray<FieldUse>): { readonly text: string; readonly warn: boolean } {
  if (uses.length === 0) return { text: "Ningún flujo lo usa", warn: true };
  const flows = new Set(uses.map((use) => use.flowKey));
  if (uses.length === 1) return { text: useLabel(uses[0]!), warn: false };
  if (flows.size === 1) return { text: `${uses.length} bloques de «${uses[0]!.flowName}»`, warn: false };
  return { text: `${flows.size} flujos · ${uses.length} bloques`, warn: false };
}
