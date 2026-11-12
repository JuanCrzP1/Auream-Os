import { AWAITING_ALERT_MINUTES, type ConversationSummary } from "@contracts/ConversationContracts";

/**
 * Cuánto lleva el cliente esperando respuesta («12 min», «2 h», «3 d») y si
 * ya es urgente. Solo cuenta en chats que atiende una persona (en espera o en
 * atención): los del bot los contesta el flujo.
 */
export function waitingFor(conversation: Pick<ConversationSummary, "status" | "awaitingSince">, now = Date.now()): { readonly text: string; readonly urgent: boolean } | null {
  if (!conversation.awaitingSince || (conversation.status !== "waiting" && conversation.status !== "attending")) return null;
  const minutes = Math.max(0, Math.floor((now - Date.parse(conversation.awaitingSince)) / 60_000));
  const text = minutes < 1 ? "ahora" : minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`;
  return { text, urgent: minutes >= AWAITING_ALERT_MINUTES };
}
