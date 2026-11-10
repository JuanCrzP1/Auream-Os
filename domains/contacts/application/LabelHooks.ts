// ---------------------------------------------------------------------------
// Ganchos de las etiquetas. Contactos no conoce a quien los usa (hoy, el CRM:
// cada etapa de un embudo es una etiqueta); la composición los conecta.
// ---------------------------------------------------------------------------

/** Quién movió una etiqueta. Lo guarda el historial de quien escucha. */
export interface LabelChangeOrigin {
  /** Un flujo (bloque Etiquetas), una persona, una venta aprobada o una regla automática. */
  readonly kind: "flow" | "user" | "sale" | "auto";
  readonly userId?: string | null;
  readonly flowKey?: string | null;
  /** Una nota para el historial (por ejemplo, por qué no compró). */
  readonly note?: string | null;
}

export const ORIGIN_UNKNOWN: LabelChangeOrigin = { kind: "user" };

/**
 * Grupos de etiquetas que se excluyen: un contacto tiene como mucho una de
 * cada grupo. Al ponerle una, se le quitan las otras del mismo grupo.
 */
export interface ExclusiveLabelGroups {
  /** Los grupos que contienen alguna de estas etiquetas. */
  groupsOf(tenantId: string, labelIds: ReadonlyArray<string>): Promise<ReadonlyArray<ReadonlyArray<string>>>;
}

/** Lo que pasó con un contacto. Quien escucha no debe lanzar (y si lanza, no se deshace nada). */
export interface ContactEvents {
  contactCreated(tenantId: string, contactId: string, origin: LabelChangeOrigin): Promise<void>;
  labelsChanged(tenantId: string, contactId: string, change: { added: ReadonlyArray<string>; removed: ReadonlyArray<string> }, origin: LabelChangeOrigin): Promise<void>;
}

export const NO_EXCLUSIVE_GROUPS: ExclusiveLabelGroups = { groupsOf: async () => [] };
export const NO_CONTACT_EVENTS: ContactEvents = { contactCreated: async () => {}, labelsChanged: async () => {} };
