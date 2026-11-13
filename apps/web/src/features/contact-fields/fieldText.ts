import { CONTACT_FIELD_TYPE_LABEL, foldFieldText, type ContactFieldType, type FieldUse } from "@contracts/ContactFieldContracts";

// ---------------------------------------------------------------------------
// Cómo se cuenta un campo en pantalla: qué tan lleno está, quién lo usa y qué
// significa cada tipo. Puro: lo prueban sin pantalla.
// ---------------------------------------------------------------------------

export const TYPE_HINT: Readonly<Record<ContactFieldType, string>> = {
  text: "Cualquier respuesta escrita: un nombre, una nota, una dirección.",
  number: "Para cantidades: presupuesto, edad, unidades. Acepta 1.200 o 1,200.",
  date: "Una fecha: cumpleaños, último pago. Acepta 13/11/2026 o 2026-11-13.",
  boolean: "Sí o no: «¿ya compró?», «¿acepta promociones?».",
  list: "El cliente elige entre opciones fijas: siempre escrito igual, listo para tus condiciones."
};

/** Todos los tipos en orden, con su nombre. */
export const TYPE_CHOICES = (Object.keys(CONTACT_FIELD_TYPE_LABEL) as ContactFieldType[]).map((type) => ({ type, label: CONTACT_FIELD_TYPE_LABEL[type] }));

/** «Lista · 4» para una lista; el nombre del tipo para lo demás. */
export function typeLabel(type: ContactFieldType, options: ReadonlyArray<string> = []): string {
  return type === "list" && options.length > 0 ? `${CONTACT_FIELD_TYPE_LABEL.list} · ${options.length}` : CONTACT_FIELD_TYPE_LABEL[type];
}

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

/** Las opciones con una nueva al final, sin repetir (sin tildes ni mayúsculas). `null` si ya está o viene vacía. */
export function withOption(options: ReadonlyArray<string>, raw: string): string[] | null {
  const option = raw.replace(/\s+/g, " ").trim();
  if (!option || options.some((current) => foldFieldText(current) === foldFieldText(option))) return null;
  return [...options, option];
}
