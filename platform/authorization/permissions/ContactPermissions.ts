import type { Scope } from "../contracts/Scope";

// Permisos sobre contactos, su catálogo de etiquetas y sus campos.
export const ContactPermissions = {
  read: "contacts.read" as Scope,
  write: "contacts.write" as Scope,
  /** Organizar la estructura de los datos (Campos del cliente): dueños y administradores. */
  manage: "contacts.manage" as Scope
} as const;
