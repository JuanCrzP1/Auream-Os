import type { ConversationMessage } from "@contracts/ConversationContracts";

// ---------------------------------------------------------------------------
// El hilo tal como se pinta: las reacciones del asesor no son burbujas, sino
// un emoji sobre el mensaje al que apuntan (la última manda; vacía = quitada).
// Las reacciones sin destino conocido se ven como antes, sueltas.
// ---------------------------------------------------------------------------

export interface ThreadView {
  readonly messages: ReadonlyArray<ConversationMessage>;
  /** Emoji que el equipo puso en cada mensaje (id → emoji). */
  readonly reactions: ReadonlyMap<string, string>;
}

export function threadView(all: ReadonlyArray<ConversationMessage>): ThreadView {
  const reactions = new Map<string, string>();
  const messages: ConversationMessage[] = [];
  for (const message of all) {
    if (message.kind === "reaction" && message.direction === "outbound" && message.replyTo) {
      if (message.status === "failed") continue;
      if (message.text) reactions.set(message.replyTo.id, message.text);
      else reactions.delete(message.replyTo.id);
      continue;
    }
    messages.push(message);
  }
  return { messages, reactions };
}

/** Se le puede responder o reaccionar: un mensaje real que WhatsApp aceptó. */
export const canAct = (message: ConversationMessage) => message.kind !== "reaction" && message.status !== "failed";
