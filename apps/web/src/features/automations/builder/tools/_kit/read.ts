// ---------------------------------------------------------------------------
// Lectores defensivos para configuraciones (JSON de disco). Nunca lanzan: lo
// ilegible cae al valor por defecto. Puros, sin React.
// ---------------------------------------------------------------------------

export function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function readEnum<T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  return typeof value === "string" && (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : fallback;
}

export function readInteger(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

/** Objeto plano o `null`. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Lista de elementos con `id`. Descarta lo que no sea objeto; a un elemento
 * sin id le asigna uno estable por posición (`<prefix>-<n>`).
 */
export function readItems<T>(
  value: unknown,
  prefix: string,
  read: (record: Record<string, unknown>, id: string) => T
): T[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: T[] = [];

  value.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) return;

    const rawId = typeof record.id === "string" && record.id.trim().length > 0 ? record.id.trim() : `${prefix}-${index + 1}`;
    if (seen.has(rawId)) return;
    seen.add(rawId);

    items.push(read(record, rawId));
  });

  return items;
}

/** Lista de cadenas no vacías y sin repetir. */
export function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length > 0 && !result.includes(trimmed)) result.push(trimmed);
  }
  return result;
}

/** Sustituye un elemento por id. */
export function replaceById<T extends { readonly id: string }>(items: ReadonlyArray<T>, id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeById<T extends { readonly id: string }>(items: ReadonlyArray<T>, id: string): T[] {
  return items.filter((item) => item.id !== id);
}
