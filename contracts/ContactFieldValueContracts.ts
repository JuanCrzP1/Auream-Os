import type { ContactFieldValue } from "./ContactContracts";

// ---------------------------------------------------------------------------
// Los Campos del cliente de UN cliente (su ficha): los valores y de dónde
// salió cada uno. Contrato API ↔ web.
//
//   GET   /contact-fields/values/:contactId   valores y origen          contacts.read
//   PATCH /contact-fields/values/:contactId   { changes }               contacts.write
//
// Editar manda SOLO lo que cambió (`null` lo borra): si un flujo guarda otro
// dato mientras la ficha está abierta, no se pisa.
// ---------------------------------------------------------------------------

/**
 * De dónde salió un dato:
 *   flow  lo guardó un bloque: el que llena esa clave en ese flujo (si hay uno solo)
 *   team  lo puso alguien del equipo en la ficha
 */
export type FieldOrigin =
  | {
      readonly source: "flow";
      readonly at: string;
      readonly flowName: string | null;
      readonly blockName: string | null;
      readonly blockType: string | null;
    }
  | { readonly source: "team"; readonly at: string; readonly actorName: string | null };

export interface ContactFieldValuesResponse {
  /** Todo lo que el cliente tiene guardado (campos y datos sueltos de los flujos), sin los internos. */
  readonly values: Readonly<Record<string, ContactFieldValue>>;
  /** Solo de los datos con origen registrado. */
  readonly origins: Readonly<Record<string, FieldOrigin>>;
  /** ¿Quien mira puede editar la ficha? */
  readonly canEdit: boolean;
}

export interface SaveContactFieldValuesRequest {
  /** Clave → valor nuevo (con su tipo) o `null` para dejarlo sin dato. Solo campos definidos. */
  readonly changes: Readonly<Record<string, ContactFieldValue | null>>;
}
