import { randomUUID } from "node:crypto";
import type { ConversationMessageKind, DeliveryStatus, MessageAuthor } from "../../../contracts/ConversationContracts";
import type { InboundChannelMessage } from "../../../contracts/InboundMessageContracts";
import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import type { Conversation } from "../domain/Conversation";
import type { ConversationRepository } from "./ConversationRepository";
import type { SendResult } from "./ports/ConversationPorts";

// ---------------------------------------------------------------------------
// ConversationRecorder — guarda cada mensaje del hilo (lo usa la mensajería):
// lo que escribe el cliente, lo que responde el bot o un asesor —al momento de
// salir cada mensaje, con su id de WhatsApp— y los avisos de entregado y leído.
// ---------------------------------------------------------------------------

/** Qué guarda la bandeja de una salida del flujo o del asesor. */
function outboundRecord(result: SendResult): { kind: ConversationMessageKind; text: string; mediaUrl: string | null; mediaType: string | null; options: string[] } {
  const message: OutboundMessage = result.message;
  if (message.kind === "media" && message.media) {
    const kind = message.media.type === "file" ? "document" : message.media.type;
    return { kind, text: message.content, mediaUrl: message.media.url, mediaType: null, options: [] };
  }
  if (message.kind === "reaction") return { kind: "reaction", text: message.content, mediaUrl: null, mediaType: null, options: [] };
  if (message.interactive) {
    const body = [message.interactive.header, message.interactive.body].filter(Boolean).join("\n\n") || message.content;
    return { kind: "menu", text: body, mediaUrl: null, mediaType: null, options: message.interactive.options.map((option) => option.title) };
  }
  return { kind: "text", text: message.content, mediaUrl: null, mediaType: null, options: [] };
}

/**
 * Esperas antes de reintentar un aviso cuyos mensajes aún no están guardados:
 * WhatsApp puede avisar «entregado» antes de que termine de guardarse el
 * mensaje (se guarda apenas el proveedor confirma el envío).
 */
export const RECEIPT_RETRY_MS: ReadonlyArray<number> = [1_500, 5_000];

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ConversationRecorder {
  /** Último instante usado: dos mensajes nunca comparten hora (el orden del chat es el real). */
  private lastAt = 0;

  public constructor(
    private readonly repository: ConversationRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly sleep: Sleep = realSleep
  ) {}

  /** Guarda lo que escribió el cliente. Devuelve su chat (y si el bot lo atiende). */
  public async recordInbound(tenantId: string, message: InboundChannelMessage, contactId: string | null): Promise<Conversation> {
    const conversation = await this.repository.findOrCreate(tenantId, message.connectionId, message.phone, contactId);
    await this.repository.append({
      id: randomUUID(),
      tenantId,
      conversationId: conversation.id,
      direction: "inbound",
      author: "contact",
      kind: message.kind,
      text: message.text,
      mediaUrl: message.media?.url ?? null,
      mediaType: message.media?.mimeType ?? null,
      options: [],
      status: "received",
      error: null,
      flowKey: null,
      agentId: null,
      agentName: null,
      providerMessageId: message.providerMessageId,
      replyToId: null,
      createdAt: message.sentAt
    });
    return conversation;
  }

  /** El chat de ese cliente en ese número; lo abre si no existe (un flujo iniciado desde fuera, p. ej. un webhook). */
  public async openChat(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<{ readonly id: string }> {
    const conversation = await this.repository.findOrCreate(tenantId, connectionId, phone, contactId);
    return { id: conversation.id };
  }

  /** El chat de ese cliente en ese número (para los despertadores de los flujos). */
  public async findChat(tenantId: string, connectionId: string, phone: string) {
    const conversation = await this.repository.findByPhone(tenantId, connectionId, phone);
    return conversation ? { id: conversation.id, botEnabled: conversation.botEnabled, connectionDeleted: conversation.connectionDeleted } : null;
  }

  /**
   * Entregado o leído (avisos del proveedor) de lo que salió por ese número.
   * Solo avanza. Si falta alguno de sus mensajes, reintenta un par de veces.
   * Devuelve cuántos avanzaron.
   */
  public async applyReceipts(tenantId: string, connectionId: string, providerMessageIds: ReadonlyArray<string>, status: DeliveryStatus): Promise<number> {
    const ids = [...new Set(providerMessageIds)];
    let outcome = await this.repository.markDelivery(tenantId, connectionId, ids, status);
    let advanced = outcome.advanced;
    for (const waitMs of RECEIPT_RETRY_MS) {
      if (outcome.matched >= ids.length) break;
      await this.sleep(waitMs);
      outcome = await this.repository.markDelivery(tenantId, connectionId, ids, status);
      advanced += outcome.advanced;
    }
    return advanced;
  }

  /**
   * Guarda lo que salió (o no) hacia el cliente: del bot o de un asesor.
   * `replyToId` (mensaje del hilo citado, o el de una reacción) va en el primero.
   */
  public async recordOutbound(
    tenantId: string,
    conversationId: string,
    results: ReadonlyArray<SendResult>,
    origin: { readonly author: Exclude<MessageAuthor, "contact">; readonly flowKey?: string; readonly agentId?: string; readonly agentName?: string; readonly replyToId?: string }
  ): Promise<void> {
    for (const [index, result] of results.entries()) {
      this.lastAt = Math.max(this.now().getTime(), this.lastAt + 1);
      const at = this.lastAt;
      const record = outboundRecord(result);
      await this.repository.append({
        id: randomUUID(),
        tenantId,
        conversationId,
        direction: "outbound",
        author: origin.author,
        ...record,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : (result.error ?? "No se pudo enviar.").slice(0, 300),
        flowKey: origin.flowKey ?? null,
        agentId: origin.agentId ?? null,
        agentName: origin.agentName ?? null,
        providerMessageId: result.providerMessageId ?? null,
        replyToId: index === 0 ? (origin.replyToId ?? null) : null,
        createdAt: new Date(at).toISOString()
      });
    }
  }
}
