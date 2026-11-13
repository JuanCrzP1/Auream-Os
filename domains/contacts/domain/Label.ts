/** Etiqueta del catálogo de una cuenta. El nombre es único sin distinguir mayúsculas, tildes ni caracteres invisibles. */
export interface Label {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly color: string;
  readonly createdAt: string;
}

export const MAX_LABEL_NAME = 40;

/**
 * Caracteres que no se ven pero cambian el texto: marcas de dirección (las
 * que trae WhatsApp al copiar una etiqueta: «‎Pagado»), espacios de ancho
 * cero y el espacio duro. Se quitan: dos etiquetas que se ven igual son la
 * misma.
 */
const INVISIBLE = /[\p{Cf}  -   　]/gu;

/** Nombre limpio: sin caracteres invisibles ni espacios sobrantes o dobles. */
export function normalizeLabelName(name: string): string {
  return name.replace(INVISIBLE, " ").trim().replace(/\s+/g, " ");
}

/** Clave de unicidad: «VIP», «vip», «Vïp» y «‎VIP» son la misma etiqueta. */
export function labelKey(name: string): string {
  return normalizeLabelName(name).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function isValidLabelColor(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}
