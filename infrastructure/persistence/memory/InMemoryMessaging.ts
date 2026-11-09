import type { InboundChannelMessage, InboundOutcome } from "../../../contracts/InboundMessageContracts";
import type { ConversationLock, InboundMessageLog } from "../../../domains/messaging/application/ports/MessagingPorts";

/** Registro de mensajes en memoria (tests). */
export class InMemoryInboundMessageLog implements InboundMessageLog {
  public readonly entries = new Map<string, { message: InboundChannelMessage; outcome?: InboundOutcome; detail?: unknown }>();

  public async claim(tenantId: string, message: InboundChannelMessage): Promise<boolean> {
    const key = `${tenantId}:${message.connectionId}:${message.providerMessageId}`;
    if (this.entries.has(key)) return false;
    this.entries.set(key, { message });
    return true;
  }

  public async finish(tenantId: string, connectionId: string, providerMessageId: string, outcome: InboundOutcome, detail: unknown): Promise<void> {
    const entry = this.entries.get(`${tenantId}:${connectionId}:${providerMessageId}`);
    if (entry) Object.assign(entry, { outcome, detail });
  }
}

/** Candado en memoria: encola el trabajo por clave (tests y desarrollo). */
export class InMemoryConversationLock implements ConversationLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  public withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    this.tails.set(key, next);
    return next;
  }
}
