import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { ContactFieldValue } from "../../../contracts/ContactContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { FieldShape } from "../domain/ContactField";
import type { ObservedValues } from "../domain/fieldDiscovery";

// Lo que el módulo de campos necesita de fuera (la base, los flujos).

export interface ContactFieldRepository {
  list(tenantId: string): Promise<ContactFieldDefinition[]>;
  find(tenantId: string, id: string): Promise<ContactFieldDefinition | null>;
  /** El campo con esa clave, o `null`. */
  findByKey(tenantId: string, key: string): Promise<ContactFieldDefinition | null>;
  /** `null` si la clave ya existe en la cuenta. */
  create(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null>;
  update(tenantId: string, id: string, field: FieldShape): Promise<ContactFieldDefinition | null>;
  /** Borra la definición y el dato de todos los clientes (en una transacción). */
  remove(tenantId: string, id: string, key: string): Promise<boolean>;
}

/** Los datos guardados en los clientes (`contacts.custom_fields`). */
export interface ContactFieldValues {
  totalContacts(tenantId: string): Promise<number>;
  /** Clientes que tienen cada clave. */
  filledCounts(tenantId: string, keys: ReadonlyArray<string>): Promise<ReadonlyMap<string, number>>;
  /** Todas las claves guardadas en los clientes, con sus valores más frecuentes. */
  observed(tenantId: string): Promise<ReadonlyMap<string, ObservedValues>>;
  /** Escribe en el cliente solo las claves dadas (ya convertidas), sin tocar las demás. */
  merge(tenantId: string, contactId: string, values: Readonly<Record<string, string | number | boolean>>): Promise<void>;
  /** Lo que tiene guardado un cliente de la cuenta, o `null` si no existe. */
  ofContact(tenantId: string, contactId: string): Promise<Record<string, ContactFieldValue> | null>;
  /** Deja sin dato esas claves del cliente, sin tocar las demás. */
  clear(tenantId: string, contactId: string, keys: ReadonlyArray<string>): Promise<void>;
}

/** Quién dejó el dato: un bloque de un flujo, o alguien del equipo en la ficha. */
export type OriginWrite = { readonly source: "flow"; readonly flowKey: string } | { readonly source: "team"; readonly actorId: string };

export interface StoredOrigin {
  readonly key: string;
  readonly source: "flow" | "team";
  readonly flowKey: string | null;
  readonly actorId: string | null;
  readonly at: string;
}

/** De dónde salió el dato de cada cliente (el último origen por clave). */
export interface FieldOrigins {
  record(tenantId: string, contactId: string, keys: ReadonlyArray<string>, origin: OriginWrite): Promise<void>;
  forContact(tenantId: string, contactId: string): Promise<ReadonlyArray<StoredOrigin>>;
  forget(tenantId: string, contactId: string, keys: ReadonlyArray<string>): Promise<void>;
}

/** Sin registro de orígenes (pruebas y lugares donde no aplica). */
export const NO_ORIGINS: FieldOrigins = { record: async () => undefined, forContact: async () => [], forget: async () => undefined };

/** Los nombres del equipo de la cuenta (para «Lo cambió Ana»). */
export interface TeamNames {
  names(tenantId: string): Promise<ReadonlyMap<string, string>>;
}

/** Los borradores de los flujos de la cuenta (lo que corre). */
export interface FlowDrafts {
  drafts(tenantId: string): Promise<ReadonlyArray<BuilderFlowSnapshot>>;
}
