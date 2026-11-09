import type { ConversationMessage } from "@contracts/ConversationContracts";

// El hilo en vivo: lo que llega (nuevo, o un mensaje que cambió —entregado,
// leído, fallido—) se une por id a lo que ya se ve, en el orden del chat.
// Si nada cambió, devuelve la misma lista (la pantalla no se vuelve a pintar).

const order = (a: ConversationMessage, b: ConversationMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const same = (a: ConversationMessage, b: ConversationMessage) =>
  a.status === b.status && a.error === b.error && a.text === b.text && a.mediaUrl === b.mediaUrl && a.flowName === b.flowName;

export function mergeThread(
  current: ReadonlyArray<ConversationMessage>,
  incoming: ReadonlyArray<ConversationMessage>
): { readonly messages: ReadonlyArray<ConversationMessage>; readonly changed: boolean } {
  const byId = new Map(current.map((message) => [message.id, message]));
  let changed = false;
  for (const message of incoming) {
    const known = byId.get(message.id);
    if (known && same(known, message)) continue;
    byId.set(message.id, message);
    changed = true;
  }
  return changed ? { messages: [...byId.values()].sort(order), changed } : { messages: current, changed };
}

/** Un mensaje de hace menos de `windowMs`: el chat está en movimiento. */
export function isRecent(message: ConversationMessage | undefined, windowMs: number, now = Date.now()): boolean {
  return message !== undefined && now - Date.parse(message.createdAt) < windowMs;
}
