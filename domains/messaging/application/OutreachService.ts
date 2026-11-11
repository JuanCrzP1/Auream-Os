import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import type { StartFlowService } from "./StartFlowService";
import type { ConversationLog, OutboundDelivery } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// OutreachService — escribirle primero a un cliente (difusiones): un flujo
// desde su inicio o unos mensajes sueltos, por un número de la cuenta. Abre su
// chat si no existe y todo lo enviado queda en él, como si lo hubiera enviado
// el bot. Devuelve el id que WhatsApp le dio al primer mensaje: con él se sabe
// después si se entregó y si lo leyó.
// ---------------------------------------------------------------------------

export interface OutreachTarget {
  readonly connectionId: string;
  readonly phone: string;
  readonly contactId: string | null;
}

export interface OutreachResult {
  readonly ok: boolean;
  readonly providerMessageId: string | null;
  readonly error: string | null;
}

export class OutreachService {
  public constructor(
    private readonly chats: Pick<ConversationLog, "openChat" | "recordOutbound">,
    private readonly delivery: OutboundDelivery,
    private readonly starter: Pick<StartFlowService, "launch">
  ) {}

  /** Corta lo que el cliente estuviera haciendo en ese número y empieza el flujo. */
  public async sendFlow(tenantId: string, target: OutreachTarget, automationId: string): Promise<OutreachResult> {
    const chat = await this.chats.openChat(tenantId, target.connectionId, target.phone, target.contactId);
    const outcome = await this.starter.launch(tenantId, { id: chat.id, connectionId: target.connectionId, phone: target.phone }, automationId);
    if (outcome.sent === 0) return { ok: false, providerMessageId: null, error: outcome.error ?? "El flujo no envió nada al empezar." };
    return { ok: true, providerMessageId: outcome.firstMessageId, error: null };
  }

  /** Envía los mensajes en orden (si uno falla, los demás igual se intentan). Basta uno entregado. */
  public async sendMessages(tenantId: string, target: OutreachTarget, messages: ReadonlyArray<Omit<OutboundMessage, "channel" | "conversationKey">>): Promise<OutreachResult> {
    const chat = await this.chats.openChat(tenantId, target.connectionId, target.phone, target.contactId);
    const outbound = messages.map((message) => ({ ...message, channel: "whatsapp", conversationKey: chat.id }));
    const report = await this.delivery.deliver(tenantId, target.connectionId, target.phone, outbound);
    await this.chats.recordOutbound(tenantId, chat.id, report.results, { author: "bot" });
    const failed = report.results.find((result) => !result.ok);
    const first = report.results.find((result) => result.ok);
    if (!first) return { ok: false, providerMessageId: null, error: failed?.error ?? "WhatsApp no aceptó el mensaje." };
    return { ok: true, providerMessageId: first.providerMessageId ?? null, error: failed?.error ?? null };
  }
}
