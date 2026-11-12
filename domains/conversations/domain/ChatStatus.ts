import type { ConversationStatus } from "../../../contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// Las reglas de la atención de un chat (las cumplen igual la base de datos y
// la versión en memoria):
//
//   el bot atiende                         → bot
//   el bot se pausa, sin responsable       → en espera
//   el bot se pausa, con responsable       → en atención
//   un asesor lo toma o responde           → en atención (queda de responsable
//                                             si no había otro)
//   un asesor lo resuelve                  → resuelto, y el bot vuelve a atender
//   el cliente escribe en un chat resuelto → se reabre: con bot (o en espera si
//                                             el bot está en pausa)
// ---------------------------------------------------------------------------

/** El estado al activar o pausar el bot. */
export function statusForBot(botEnabled: boolean, assigneeId: string | null): ConversationStatus {
  if (botEnabled) return "bot";
  return assigneeId ? "attending" : "waiting";
}

/** El estado cuando el cliente escribe. */
export function statusAfterInbound(status: ConversationStatus, botEnabled: boolean, assigneeId: string | null): ConversationStatus {
  return status === "resolved" ? statusForBot(botEnabled, assigneeId) : status;
}

/** El estado al pasar el chat a alguien (o dejarlo sin asignar): el bot queda en pausa. */
export function statusForAssignee(assigneeId: string | null): ConversationStatus {
  return assigneeId ? "attending" : "waiting";
}
