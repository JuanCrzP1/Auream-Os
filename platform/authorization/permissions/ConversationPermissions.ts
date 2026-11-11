import type { Scope } from "../contracts/Scope";

// Permisos sobre la bandeja de Conversaciones.
//   read    ver los chats y sus mensajes, y usar las respuestas rápidas: todo el equipo
//   write   responder, reaccionar, pausar el bot, enviar flujos y crear o editar
//           respuestas rápidas: dueños, administradores y asesores
//   manage  eliminar un chat con su historial: dueños y administradores
export const ConversationPermissions = {
  read: "conversations.read" as Scope,
  write: "conversations.write" as Scope,
  manage: "conversations.manage" as Scope
} as const;
