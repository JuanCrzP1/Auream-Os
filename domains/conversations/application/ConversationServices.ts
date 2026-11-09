import { randomUUID } from "node:crypto";
import {
  MAX_AGENT_MESSAGE_LENGTH,
  type ConversationFilter,
  type ConversationMessageKind,
  type ConversationMessagesResponse,
  type ConversationSummary,
  type MessageAuthor
} from "../../../contracts/ConversationContracts";
import type { InboundChannelMessage } from "../../../contracts/InboundMessageContracts";
import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { Conversation, StoredMessage } from "../domain/Conversation";
import type { ConversationRepository } from "./ConversationRepository";
import type { ConversationSender, FlowLauncher, SendResult } from "./ports/ConversationPorts";

// ---------------------------------------------------------------------------
// La bandeja de Conversaciones.
//
//   ConversationRecorder  guarda cada mensaje del hilo (lo usa la mensajería:
//                         lo que escribe el cliente y lo que responde el bot)
//   ConversationInbox     lo que hace el equipo en la pantalla: listar, leer,
//                         responder, pausar el bot y enviar un flujo a mano
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

export class ConversationRecorder {
  public constructor(
    private readonly repository: ConversationRepository,
    private readonly now: () => Date = () => new Date()
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
      createdAt: message.sentAt
    });
    return conversation;
  }

  /** Guarda lo que salió (o no) hacia el cliente: del bot o de un asesor. */
  public async recordOutbound(
    tenantId: string,
    conversationId: string,
    results: ReadonlyArray<SendResult>,
    origin: { readonly author: Exclude<MessageAuthor, "contact">; readonly flowKey?: string; readonly agentId?: string; readonly agentName?: string }
  ): Promise<void> {
    let at = this.now().getTime();
    for (const result of results) {
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
        providerMessageId: null,
        // Un milisegundo entre cada uno: conservan su orden al listarlos.
        createdAt: new Date(at++).toISOString()
      });
    }
  }
}

export interface Agent {
  readonly id: string;
  readonly name: string | null;
}

export class ConversationInbox {
  public constructor(
    private readonly repository: ConversationRepository,
    private readonly recorder: ConversationRecorder,
    private readonly sender: ConversationSender,
    private readonly flows: FlowLauncher
  ) {}

  public async list(tenantId: string, query: { readonly filter?: ConversationFilter; readonly search?: string; readonly connectionId?: string }): Promise<ConversationSummary[]> {
    const filter = query.filter && ["all", "unread", "bot_paused"].includes(query.filter) ? query.filter : "all";
    return this.repository.inbox(tenantId, {
      filter,
      limit: 100,
      ...(query.search?.trim() ? { search: query.search.trim().slice(0, 80) } : {}),
      ...(query.connectionId ? { connectionId: query.connectionId } : {})
    });
  }

  public async get(tenantId: string, id: string): Promise<ConversationSummary> {
    const summary = await this.repository.summary(tenantId, id);
    if (!summary) throw new NotFoundError("Conversación no encontrada.");
    return summary;
  }

  public async messages(tenantId: string, id: string, before?: string): Promise<ConversationMessagesResponse> {
    await this.require(tenantId, id);
    return this.repository.messages(tenantId, id, { limit: 50, ...(before ? { before } : {}) });
  }

  public async markRead(tenantId: string, id: string): Promise<void> {
    await this.require(tenantId, id);
    await this.repository.markRead(tenantId, id);
  }

  public async setBotEnabled(tenantId: string, id: string, enabled: unknown): Promise<ConversationSummary> {
    if (typeof enabled !== "boolean") throw new ValidationError("Indica si el bot atiende o no este chat.");
    await this.require(tenantId, id);
    await this.repository.setBotEnabled(tenantId, id, enabled);
    return this.get(tenantId, id);
  }

  /**
   * Un asesor responde. Pausa el bot en el chat: si siguiera activo, el
   * próximo mensaje del cliente lo contestaría el flujo encima del asesor.
   * Si WhatsApp no lo acepta, queda en el hilo como fallido con su motivo
   * (como en WhatsApp): no se lanza, para no invitar a reenviarlo duplicado.
   */
  public async sendAgentMessage(tenantId: string, id: string, text: unknown, agent: Agent): Promise<ConversationSummary> {
    const body = typeof text === "string" ? text.trim() : "";
    if (!body) throw new ValidationError("Escribe un mensaje.");
    if (body.length > MAX_AGENT_MESSAGE_LENGTH) throw new ValidationError(`El mensaje admite hasta ${MAX_AGENT_MESSAGE_LENGTH} caracteres.`);
    const conversation = await this.require(tenantId, id);

    const { results } = await this.sender.deliver(tenantId, conversation.connectionId, conversation.phone, [
      { channel: "whatsapp", conversationKey: conversation.id, content: body }
    ]);
    await this.recorder.recordOutbound(tenantId, conversation.id, results, { author: "agent", agentId: agent.id, ...(agent.name ? { agentName: agent.name } : {}) });
    if (conversation.botEnabled) await this.repository.setBotEnabled(tenantId, id, false);
    return this.get(tenantId, id);
  }

  /** Envía un flujo a mano: corta lo que el cliente estuviera haciendo y lo empieza; el bot queda activo. */
  public async startFlow(tenantId: string, id: string, automationId: unknown): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
    if (typeof automationId !== "string" || !automationId) throw new ValidationError("Elige el flujo que quieres enviar.");
    const conversation = await this.require(tenantId, id);
    if (!conversation.botEnabled) await this.repository.setBotEnabled(tenantId, id, true);
    return this.flows.launch(tenantId, conversation, automationId);
  }

  private async require(tenantId: string, id: string): Promise<Conversation> {
    const conversation = await this.repository.findById(tenantId, id);
    if (!conversation) throw new NotFoundError("Conversación no encontrada.");
    return conversation;
  }
}
