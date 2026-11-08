/** Etiqueta del catálogo de una cuenta. El nombre es único sin distinguir mayúsculas. */
export interface Label {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly color: string;
  readonly createdAt: string;
}

export const MAX_LABEL_NAME = 40;

/** Nombre limpio: sin espacios sobrantes ni dobles. */
export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Clave de unicidad: «VIP» y «vip» son la misma etiqueta. */
export function labelKey(name: string): string {
  return normalizeLabelName(name).toLowerCase();
}

export function isValidLabelColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}
