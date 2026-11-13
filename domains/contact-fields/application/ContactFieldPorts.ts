import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { BuilderFlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { FieldShape } from "../domain/ContactField";
import type { ObservedValues } from "../domain/fieldDiscovery";

// Lo que el módulo de campos necesita de fuera (la base, los flujos).

export interface ContactFieldRepository {
  list(tenantId: string): Promise<ContactFieldDefinition[]>;
  find(tenantId: string, id: string): Promise<ContactFieldDefinition | null>;
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
}

/** Los borradores de los flujos de la cuenta (lo que corre). */
export interface FlowDrafts {
  drafts(tenantId: string): Promise<ReadonlyArray<BuilderFlowSnapshot>>;
}
