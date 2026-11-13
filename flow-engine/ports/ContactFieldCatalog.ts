import type { TypedField } from "../../contracts/FieldValues";

/**
 * Los Campos del cliente de la cuenta, para saber el tipo de una clave
 * (Esperar respuesta vuelve a preguntar si la respuesta no encaja). Solo
 * lectura. Producción y laboratorio: el catálogo real de la cuenta.
 */
export interface ContactFieldCatalog {
  /** El campo con esa clave, o `null` si la clave no es un campo (un dato de la conversación). */
  find(tenantId: string, key: string): Promise<TypedField | null>;
}

/** Sin catálogo: ninguna clave tiene tipo (el bloque sigue igual que siempre). */
export const NO_CONTACT_FIELDS: ContactFieldCatalog = { find: async () => null };
