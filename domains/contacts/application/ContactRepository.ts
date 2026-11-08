import type { Contact } from "../domain/Contact";
import type { Label } from "../domain/Label";

export interface ContactQuery {
  /** Texto libre: nombre, teléfono o correo. */
  readonly search?: string;
  /** Solo contactos con esta etiqueta. */
  readonly labelId?: string;
  readonly page: number;
  readonly limit: number;
}

/** Un contacto con sus etiquetas. */
export interface ContactWithLabels {
  readonly contact: Contact;
  readonly labels: ReadonlyArray<Label>;
}

/** Puerto de persistencia de contactos. Todo, siempre, por tenant. */
export interface ContactRepository {
  list(tenantId: string, query: ContactQuery): Promise<{ items: ContactWithLabels[]; hasMore: boolean }>;
  findById(tenantId: string, id: string): Promise<ContactWithLabels | null>;
  findByIdentity(tenantId: string, channel: string, externalKey: string): Promise<ContactWithLabels | null>;
  /** Inserta; si (canal, clave) ya existe en la cuenta devuelve el existente. */
  create(contact: Contact): Promise<ContactWithLabels>;
  update(contact: Contact): Promise<void>;
  /** Reemplaza las etiquetas del contacto por exactamente estas (atómico). */
  setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>): Promise<void>;
  /** Añade y quita etiquetas sin tocar las demás (atómico). */
  changeLabels(tenantId: string, contactId: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }): Promise<void>;
}

/** Puerto de persistencia del catálogo de etiquetas. */
export interface LabelRepository {
  list(tenantId: string): Promise<Array<Label & { contactCount: number }>>;
  findById(tenantId: string, id: string): Promise<Label | null>;
  /** Por nombre, sin distinguir mayúsculas. */
  findByNames(tenantId: string, names: ReadonlyArray<string>): Promise<Label[]>;
  /** Inserta; si ya existe una con ese nombre lanza `ConflictError`. */
  create(label: Label): Promise<void>;
  update(label: Label): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
