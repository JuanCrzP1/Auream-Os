import type { Scope } from "../contracts/Scope";

// Permisos sobre contactos y su catálogo de etiquetas.
export const ContactPermissions = {
  read: "contacts.read" as Scope,
  write: "contacts.write" as Scope
} as const;
