import type { Scope } from "../contracts/Scope";

// Permisos sobre las difusiones (`/broadcasts`).
//   read     ver las difusiones y sus resultados: todo el equipo
//   manage   crear, enviar, pausar y cancelar, y las audiencias guardadas:
//            dueños y administradores (una difusión habla en nombre del negocio)
export const BroadcastPermissions = {
  read: "broadcasts.read" as Scope,
  manage: "broadcasts.manage" as Scope
} as const;
