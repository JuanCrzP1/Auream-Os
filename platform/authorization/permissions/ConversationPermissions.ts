import type { Scope } from "../contracts/Scope";

// Permisos sobre la bandeja de Conversaciones.
//   read    ver los chats y sus mensajes, y las respuestas rápidas: todo el equipo
//   write   responder (también con respuestas rápidas), reaccionar, pausar el
//           bot y enviar flujos: dueños, administradores y asesores
//   manage  eliminar un chat con su historial y organizar las respuestas
//           rápidas (Configuración): dueños y administradores
export const ConversationPermissions = {
  read: "conversations.read" as Scope,
  write: "conversations.write" as Scope,
  manage: "conversations.manage" as Scope
} as const;
