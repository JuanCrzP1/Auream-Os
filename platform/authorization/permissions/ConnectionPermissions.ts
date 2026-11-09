import type { Scope } from "../contracts/Scope";

// Permisos sobre las conexiones de WhatsApp de la cuenta.
//   read   ver los números y su estado: todo el equipo
//   write  crear, vincular, renombrar o eliminar: dueños y administradores
export const ConnectionPermissions = {
  read: "connections.read" as Scope,
  write: "connections.write" as Scope
} as const;
