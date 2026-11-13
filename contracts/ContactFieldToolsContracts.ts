import type { ContactFieldType, FieldUse } from "./ContactFieldContracts";

// ---------------------------------------------------------------------------
// Herramientas del catálogo de Campos del cliente (dueños y administradores):
//
//   GET  /contact-fields/:id/values           los valores escritos y cómo agruparlos   contacts.manage
//   POST /contact-fields/:id/tidy             ordenar valores (los que tú confirmas)   contacts.manage
//   POST /contact-fields/merge/preview        qué cambia al unir campos                contacts.manage
//   POST /contact-fields/merge                unir campos en uno                       contacts.manage
//   POST /contact-fields/operations/:id/undo  deshacer (hasta 7 días)                  contacts.manage
//   GET  /contact-fields/:id/sales            lo que vende cada valor                  contacts.read + sales.read
//
// Nada cambia sin confirmación, y ordenar y unir se pueden deshacer.
// ---------------------------------------------------------------------------

/** Días en que una operación se puede deshacer. */
export const FIELD_OPERATION_UNDO_DAYS = 7;

/** Qué proponemos hacer con un grupo de valores escritos parecido. */
export type TidyProposal =
  | { readonly kind: "option"; readonly to: string } // una opción que ya existe
  | { readonly kind: "new"; readonly to: string } //    una opción nueva
  | { readonly kind: "keep" }; //                       dejar como está

export interface FieldValueGroup {
  /** Las formas en que está escrito (la más usada primero). */
  readonly values: ReadonlyArray<{ readonly value: string; readonly count: number }>;
  readonly count: number;
  readonly proposal: TidyProposal;
}

export interface FieldValuesResponse {
  readonly fieldId: string;
  readonly key: string;
  readonly label: string;
  readonly type: ContactFieldType;
  readonly options: ReadonlyArray<string>;
  readonly filled: number;
  readonly distinct: number;
  readonly groups: ReadonlyArray<FieldValueGroup>;
  /** Hay más valores distintos de los que se muestran (los menos usados quedan como están). */
  readonly truncated: boolean;
}

export interface TidyFieldRequest {
  /** Cada grupo confirmado: sus valores pasan a `to`; `null` los deja sin dato. Lo que no se manda queda como está. */
  readonly assignments: ReadonlyArray<{ readonly values: ReadonlyArray<string>; readonly to: string | null }>;
}

export interface FieldOperationSummary {
  readonly id: string;
  readonly kind: "tidy" | "merge";
  /** Para leer: «Ordenaste "Ciudad"», «Uniste 3 campos en "respuesta"». */
  readonly title: string;
  /** Clientes cuyo dato cambió. */
  readonly contacts: number;
  readonly at: string;
  readonly undoUntil: string;
}

export interface MergeFieldsRequest {
  /** La clave que queda. */
  readonly keep: string;
  /** Las que se pasan a ella. */
  readonly merge: ReadonlyArray<string>;
}

export interface MergePreview {
  readonly keys: ReadonlyArray<{ readonly key: string; readonly label: string | null; readonly filled: number; readonly blocks: number }>;
  /** Los bloques que pasarían a usar la clave que queda. */
  readonly blocks: ReadonlyArray<FieldUse & { readonly key: string }>;
  /** Clientes que tienen más de una de las claves (se queda el dato más reciente). */
  readonly conflicts: number;
}

export interface FieldOperationResponse {
  readonly operation: FieldOperationSummary;
  /** Flujos que no se pudieron actualizar (alguien los estaba editando): hay que cambiar la clave a mano. */
  readonly flowsSkipped: ReadonlyArray<string>;
}

export interface UndoOperationResponse {
  /** Clientes cuyo dato volvió a como estaba (los que cambiaron después no se tocan). */
  readonly contacts: number;
  readonly blocksSkipped: number;
}

export interface FieldSalesResponse {
  readonly days: number;
  /** Una entrada por moneda (la de más ventas primero): no se mezclan monedas. */
  readonly currencies: ReadonlyArray<{
    readonly currency: string;
    readonly total: number;
    /** `value: null` = clientes sin el dato. */
    readonly values: ReadonlyArray<{ readonly value: string | null; readonly amount: number; readonly sales: number; readonly clients: number }>;
  }>;
}

/** Lo que conviene ordenar en el catálogo (sale en «por ordenar»). */
export interface FieldSuggestions {
  /** Campos cuyos valores están escritos de varias formas o fuera de su lista. */
  readonly toTidy: ReadonlyArray<{ readonly fieldId: string; readonly label: string; readonly kind: "stray" | "asList"; readonly count: number; readonly examples: ReadonlyArray<string> }>;
  /** Grupos de claves que parecen guardar el mismo dato. */
  readonly toMerge: ReadonlyArray<{ readonly keys: ReadonlyArray<string> }>;
  /** Lo que se hizo en los últimos días y aún se puede deshacer. */
  readonly operations: ReadonlyArray<FieldOperationSummary>;
}
