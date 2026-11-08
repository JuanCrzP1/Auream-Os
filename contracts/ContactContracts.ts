// ---------------------------------------------------------------------------
// Contactos y etiquetas — contratos compartidos por la API, el frontend y el
// motor de flujos. El tenant NUNCA viaja al cliente: lo decide el servidor.
// ---------------------------------------------------------------------------

/** Colores de etiqueta ofrecidos (hex). Cualquier `#rrggbb` es válido. */
export const LABEL_COLORS = [
  "#64748b", "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899"
] as const;

export const DEFAULT_LABEL_COLOR = LABEL_COLORS[0];

/** Valor de un campo personalizado del contacto. */
export type ContactFieldValue = string | number | boolean;

export interface LabelSummary {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  /** Contactos que la tienen (solo en el listado del catálogo). */
  readonly contactCount?: number;
}

export interface ContactSummary {
  readonly id: string;
  readonly channel: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly customFields: Readonly<Record<string, ContactFieldValue>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ContactListResponse {
  readonly contacts: ReadonlyArray<ContactSummary>;
  readonly page: number;
  readonly hasMore: boolean;
}

export interface CreateContactRequest {
  readonly name?: string;
  readonly phone: string;
  readonly email?: string;
}

/** Campos editables. `customFields` reemplaza el conjunto completo. */
export interface UpdateContactRequest {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly customFields?: Readonly<Record<string, ContactFieldValue>>;
}

/** Reemplaza las etiquetas del contacto por exactamente estas. */
export interface SetContactLabelsRequest {
  readonly labelIds: ReadonlyArray<string>;
}

export interface CreateLabelRequest {
  readonly name: string;
  readonly color?: string;
}

export interface UpdateLabelRequest {
  readonly name?: string;
  readonly color?: string;
}

/**
 * Lo que el MOTOR ve de un contacto mientras ejecuta un flujo: identidad,
 * datos, nombres de etiquetas y campos personalizados.
 */
export interface ContactProfile {
  readonly id: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly tags: ReadonlyArray<string>;
  readonly fields: Readonly<Record<string, ContactFieldValue>>;
}

/** Cómo llega un contacto al motor: por canal y su identificador en él. */
export interface ContactIdentity {
  readonly channel: string;
  /** Teléfono en WhatsApp, id de usuario en otros canales. */
  readonly externalKey: string;
}
