import type { ContactFieldDefinition } from "../../../contracts/ContactFieldContracts";
import type { FieldShape } from "../domain/ContactField";
import type { ObservedValues } from "../domain/fieldDiscovery";
import type { BlockChange } from "../domain/fieldMerge";

// Lo que las herramientas del catálogo (ordenar, unir, deshacer, lo que vende) necesitan de fuera.

/** Una operación guardada, con lo necesario para deshacerla. */
export interface StoredOperation {
  readonly id: string;
  readonly kind: "tidy" | "merge";
  readonly title: string;
  readonly contacts: number;
  /** Las claves que tocó en los clientes. */
  readonly keys: ReadonlyArray<string>;
  /** Al deshacer: definiciones que vuelven a como estaban y las que se quitan (las creó la operación). */
  readonly definitions: { readonly restore: ReadonlyArray<ContactFieldDefinition>; readonly remove: ReadonlyArray<string> };
  readonly flows: ReadonlyArray<BlockChange>;
  readonly createdAt: string;
  readonly undoneAt: string | null;
}

export interface TidyWrite {
  readonly operationId: string;
  readonly title: string;
  readonly actorId: string;
  readonly previous: ContactFieldDefinition;
  /** El campo después (lista con sus opciones). */
  readonly next: FieldShape;
  /** Valor escrito → opción (`null`: sin dato). */
  readonly map: Readonly<Record<string, string | null>>;
}

export interface MergeWrite {
  readonly operationId: string;
  readonly title: string;
  readonly actorId: string;
  readonly keep: string;
  readonly merge: ReadonlyArray<string>;
  /** Definiciones de las claves que se unen (se borran; al deshacer vuelven). */
  readonly merged: ReadonlyArray<ContactFieldDefinition>;
  /** Si la clave que queda aún no era un campo, se crea. */
  readonly createKeep: { readonly id: string; readonly shape: FieldShape } | null;
}

export interface ValueSales {
  readonly value: string | null;
  readonly currency: string;
  readonly amount: number;
  readonly sales: number;
  readonly clients: number;
}

/** Lo que se lee de los clientes (solo lectura). */
export interface FieldInsights {
  /** Los valores escritos de una clave (los más usados primero). */
  values(tenantId: string, key: string, limit: number): Promise<ObservedValues>;
  /** Clientes que tienen más de una de esas claves con dato. */
  conflicts(tenantId: string, keys: ReadonlyArray<string>): Promise<number>;
  /** Ventas aprobadas desde `since`, por valor del campo y moneda. */
  salesByValue(tenantId: string, key: string, since: Date): Promise<ReadonlyArray<ValueSales>>;
}

/** Cada escritura es UNA transacción: definición, clientes y registro para deshacer. */
export interface FieldOperations {
  /** Clientes cuyo dato cambió. */
  tidy(tenantId: string, write: TidyWrite): Promise<number>;
  merge(tenantId: string, write: MergeWrite): Promise<number>;
  attachFlows(tenantId: string, operationId: string, flows: ReadonlyArray<BlockChange>): Promise<void>;
  recent(tenantId: string, since: Date): Promise<ReadonlyArray<StoredOperation>>;
  find(tenantId: string, operationId: string): Promise<StoredOperation | null>;
  /** Devuelve los clientes restaurados, o `null` si ya estaba deshecha. */
  undo(tenantId: string, operation: StoredOperation): Promise<number | null>;
}

/** Cambiar las claves dentro de los flujos de la cuenta (y devolverlas). */
export interface FlowRewriter {
  rename(tenantId: string, rename: ReadonlyMap<string, string>): Promise<{ readonly changes: BlockChange[]; readonly skipped: string[] }>;
  restore(tenantId: string, changes: ReadonlyArray<BlockChange>): Promise<{ readonly skipped: number }>;
}
