import type { Scope } from "../contracts/Scope";

// Permisos sobre Grupos y comunidades (`/groups`).
//   read     ver campañas, grupos y resultados: todo el equipo
//   manage   crear y editar campañas, sincronizar, enviar a grupos: dueños y
//            administradores (hablan en nombre del negocio ante miles de personas)
export const GroupPermissions = {
  read: "groups.read" as Scope,
  manage: "groups.manage" as Scope
} as const;
