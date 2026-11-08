// ---------------------------------------------------------------------------
// Lectores defensivos para configuraciones (JSON de disco). Nunca lanzan: lo
// ilegible cae al valor por defecto. Puros, sin React.
// ---------------------------------------------------------------------------

// Los lectores viven en el contrato compartido: el motor lee la configuración
// con las mismas funciones que el builder.
export {
  asRecord,
  readBoolean,
  readEnum,
  readInteger,
  readItems,
  readString,
  readStringList
} from "@contracts/ConfigReaders";

/** Sustituye un elemento por id. */
export function replaceById<T extends { readonly id: string }>(items: ReadonlyArray<T>, id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeById<T extends { readonly id: string }>(items: ReadonlyArray<T>, id: string): T[] {
  return items.filter((item) => item.id !== id);
}
