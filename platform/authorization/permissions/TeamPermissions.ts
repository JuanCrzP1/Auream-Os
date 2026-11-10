import type { Scope } from "../contracts/Scope";

// Permisos sobre el equipo de la cuenta (Configuración → Equipo).
//   read     ver quién está y con qué rol: todo el equipo
//   manage   invitar, cambiar roles y quitar: dueños y administradores. A quién
//            puede tocar cada uno (un administrador no toca a los dueños) lo
//            decide `domains/team/domain/TeamPolicy`, no un scope.
export const TeamPermissions = {
  read: "team.read" as Scope,
  manage: "team.manage" as Scope
} as const;
