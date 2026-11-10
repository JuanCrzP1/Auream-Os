import type { Scope } from "../contracts/Scope";

// Permisos sobre el CRM (`/crm`).
//   read     ver los embudos, el tablero, las fichas y los seguimientos: todo el equipo
//   write    mover clientes de etapa, poner valor y responsable, y llevar
//            seguimientos (el asesor que atiende)
//   manage   crear, configurar y quitar embudos: dueños y administradores
export const CrmPermissions = {
  read: "crm.read" as Scope,
  write: "crm.write" as Scope,
  manage: "crm.manage" as Scope
} as const;
