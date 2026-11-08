import type { Scope } from "../contracts/Scope";

// Permisos sobre las conexiones con servicios externos (claves de IA).
//   read   ver la lista (sin claves) y elegir una en un bloque: quien edita flujos
//   write  conectar, cambiar la clave o borrar: dueños y administradores
export const CredentialPermissions = {
  read: "credentials.read" as Scope,
  write: "credentials.write" as Scope
} as const;
