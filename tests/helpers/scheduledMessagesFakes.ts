import type { ScheduledMessageStatus } from "../../contracts/ScheduledMessageContracts";
import type { Conversation } from "../../domains/conversations/domain/Conversation";
import type { StoredScheduledMessage } from "../../domains/conversations/domain/ScheduledMessage";
import type { NewScheduledMessage, ScheduledMessageRepository } from "../../domains/conversations/application/ScheduledMessagePorts";
import type { SendResult } from "../../domains/conversations/application/ports/ConversationPorts";
import { ScheduledMessageDispatcher } from "../../domains/conversations/application/ScheduledMessageDispatcher";
import { ScheduledMessageService } from "../../domains/conversations/application/ScheduledMessageService";

// Dobles en memoria para probar los mensajes programados sin base ni WhatsApp.

export const CHAT = "c0c0c0c0-0000-4000-8000-000000000001";
export const AUTHOR = "a0a0a0a0-0000-4000-8000-000000000001";

export class MemoryScheduledMessages implements ScheduledMessageRepository {
  public readonly rows = new Map<string, StoredScheduledMessage>();
  public lastInbound: string | null = null;

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public async open(tenantId: string, conversationId: string) {
    return [...this.rows.values()]
      .filter((row) => row.tenantId === tenantId && row.conversationId === conversationId && ["pending", "sending", "failed", "skipped"].includes(row.status))
      .sort((a, b) => a.sendAt.localeCompare(b.sendAt));
  }
  public async find(tenantId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.tenantId === tenantId ? row : null;
  }
  public async countPending(tenantId: string, conversationId: string) {
    return (await this.open(tenantId, conversationId)).filter((row) => row.status === "pending").length;
  }
  public async insert(message: NewScheduledMessage) {
    const { sendAt, ...rest } = message;
    const now = this.now().toISOString();
    this.rows.set(message.id, { ...rest, sendAt: sendAt.toISOString(), status: "pending", error: null, authorName: "Ana", armedAt: now, claimedAt: null, createdAt: now });
  }
  public async update(tenantId: string, id: string, changes: { parts: StoredScheduledMessage["parts"]; sendAt: Date; cancelIfReplied: boolean; armedAt: Date }) {
    const row = await this.find(tenantId, id);
    if (row?.status !== "pending") return false;
    this.rows.set(id, { ...row, parts: changes.parts, sendAt: changes.sendAt.toISOString(), cancelIfReplied: changes.cancelIfReplied, armedAt: changes.armedAt.toISOString() });
    return true;
  }
  public async claim(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>, at: Date) {
    const row = await this.find(tenantId, id);
    if (!row || !from.includes(row.status)) return null;
    const claimed = { ...row, status: "sending" as const, claimedAt: at.toISOString(), error: null };
    this.rows.set(id, claimed);
    return claimed;
  }
  public async release(tenantId: string, id: string, to: ScheduledMessageStatus) {
    const row = await this.find(tenantId, id);
    if (row?.status === "sending") this.rows.set(id, { ...row, status: to, claimedAt: null });
  }
  public async finish(tenantId: string, id: string, outcome: { status: "sent" | "failed" | "skipped"; error: string | null }) {
    const row = await this.find(tenantId, id);
    if (row?.status === "sending") this.rows.set(id, { ...row, ...outcome });
  }
  public async cancel(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>) {
    const row = await this.find(tenantId, id);
    if (!row || !from.includes(row.status)) return false;
    this.rows.set(id, { ...row, status: "cancelled" });
    return true;
  }
  public async lastInboundAt() {
    return this.lastInbound;
  }
}

export function chatOf(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: CHAT, tenantId: "t1", connectionId: "n1", contactId: null, phone: "573001112233", botEnabled: true, unreadCount: 0,
    status: "bot", assigneeId: null, connectionDeleted: false, createdAt: "2026-11-01T00:00:00.000Z", ...overrides
  };
}

/** Todo armado: el reloj se mueve con `clock.at`, el envío responde con `deliver`. */
export function scheduledHarness(options: { readonly chat?: Conversation | null; readonly now?: string } = {}) {
  const clock = { at: new Date(options.now ?? "2026-11-12T20:00:00.000Z") };
  const repository = new MemoryScheduledMessages(() => clock.at);
  const chat = options.chat === undefined ? chatOf() : options.chat;
  const chats = { findById: async (tenantId: string, id: string) => (chat && chat.tenantId === tenantId && chat.id === id ? chat : null) };
  const sent: Array<{ phone: string; count: number }> = [];
  const recorded: Array<{ agentId?: string; results: ReadonlyArray<SendResult> }> = [];
  const sender = {
    deliver: async (_tenantId: string, _connectionId: string, phone: string, messages: ReadonlyArray<{ content: string }>) => {
      sent.push({ phone, count: messages.length });
      return { results: messages.map((message) => ({ message, ok: true, providerMessageId: "wamid.1" })) as unknown as SendResult[] };
    }
  };
  const recorder = {
    recordOutbound: async (_tenantId: string, _id: string, results: ReadonlyArray<SendResult>, origin: { agentId?: string }) => {
      recorded.push({ ...(origin.agentId ? { agentId: origin.agentId } : {}), results });
    }
  };
  const armed: Array<{ id: string; at: string }> = [];
  const dispatcher = new ScheduledMessageDispatcher(repository, chats, sender as never, recorder as never, () => clock.at);
  const service = new ScheduledMessageService(
    repository,
    chats,
    dispatcher,
    { arm: async (_tenantId, _chat, id, at) => void armed.push({ id, at: at.toISOString() }) },
    { of: async () => "America/Bogota" },
    () => clock.at
  );
  return { clock, repository, sender, recorder, sent, recorded, armed, dispatcher, service };
}

export const TEXT = [{ kind: "text" as const, text: "Hola Ana, te recuerdo el pago de hoy 🙏" }];
