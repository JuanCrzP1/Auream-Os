import type { ContactIdentity, ContactProfile } from "../../contracts/ContactContracts";

// ---------------------------------------------------------------------------
// ContactDirectory — lo que el motor necesita del contacto de la conversación.
//
// El motor NO conoce el dominio de Contactos (regla de dependencias): declara
// este puerto y la composición inyecta quien lo cumpla (`ContactDirectoryService`
// sobre SQL en producción; sobre memoria en la simulación del builder).
// ---------------------------------------------------------------------------

export interface ContactDirectory {
  /** El contacto de esa identidad; si es la primera vez, se crea. */
  resolve(tenantId: string, identity: ContactIdentity): Promise<ContactProfile>;
  /** Añade etiquetas por nombre (crea en el catálogo las que falten). */
  addTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile>;
  /** Quita etiquetas por nombre; las que no tiene se ignoran. */
  removeTags(tenantId: string, contactId: string, names: ReadonlyArray<string>): Promise<ContactProfile>;
  /** Guarda campos personalizados (se combinan con los existentes). */
  setFields(tenantId: string, contactId: string, fields: Readonly<Record<string, unknown>>): Promise<ContactProfile>;
}

/** Identidad del contacto de una ejecución: el canal y su identificador en él. */
export function identityOf(envelope: { readonly channel: string; readonly userKey: string }): ContactIdentity {
  return { channel: envelope.channel, externalKey: envelope.userKey };
}
