import type { FieldFilter } from "../../../contracts/ContactFieldFilters";
import type { AdOrigin } from "../../../contracts/AdOrigin";
import type { Contact } from "../domain/Contact";
import type { Label } from "../domain/Label";
import type { LabelChangeOrigin } from "./LabelHooks";

export interface ContactQuery {
  /** Texto libre: nombre, teléfono o correo. */
  readonly search?: string;
  /** Solo contactos con esta etiqueta. */
  readonly labelId?: string;
  /** Por sus Campos del cliente (se cumplen todos). */
  readonly fields?: ReadonlyArray<FieldFilter>;
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
  /** Inserta; si (canal, clave) ya existe en la cuenta devuelve el existente. `origin`: quién lo creó (para quien escucha). */
  create(contact: Contact, origin?: LabelChangeOrigin): Promise<ContactWithLabels>;
  update(contact: Contact): Promise<void>;
  /** Guarda el anuncio por el que entró (reemplaza el anterior). */
  setAdOrigin(tenantId: string, contactId: string, ad: AdOrigin): Promise<void>;
  /** Reemplaza las etiquetas del contacto por exactamente estas (atómico). */
  setLabels(tenantId: string, contactId: string, labelIds: ReadonlyArray<string>, origin?: LabelChangeOrigin): Promise<void>;
  /** Añade y quita etiquetas sin tocar las demás (atómico). */
  changeLabels(tenantId: string, contactId: string, change: { add: ReadonlyArray<string>; remove: ReadonlyArray<string> }, origin?: LabelChangeOrigin): Promise<void>;
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
