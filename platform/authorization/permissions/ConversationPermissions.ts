import type { Scope } from "../contracts/Scope";

// Permisos sobre la bandeja de Conversaciones.
//   read   ver los chats y sus mensajes: todo el equipo
//   write  responder, pausar el bot y enviar flujos: dueños, administradores y asesores
export const ConversationPermissions = {
  read: "conversations.read" as Scope,
  write: "conversations.write" as Scope
} as const;
