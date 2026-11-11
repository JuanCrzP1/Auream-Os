import {
  CONVERSATIONS_PAGE_SIZE,
  type ConversationListQuery,
  type ConversationListResponse,
  type ConversationLiveResponse,
  type ConversationMessagesResponse,
  type ConversationSummary
} from "../../../contracts/ConversationContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { Conversation } from "../domain/Conversation";
import { parseAgentReply, parseReaction, toOutbound } from "./AgentReply";
import type { ConversationRepository } from "./ConversationRepository";
import { ConversationRecorder } from "./ConversationRecorder";
import { encodeCursor, inboxQuery } from "./InboxQuery";
import type { ContactLabeler, ConversationSender, FlowLauncher } from "./ports/ConversationPorts";

// El guardado de mensajes vive en `ConversationRecorder.ts`; se re-exporta por compatibilidad.
export { ConversationRecorder };

// ---------------------------------------------------------------------------
// La bandeja de Conversaciones.
//
//   ConversationRecorder  guarda cada mensaje del hilo (lo usa la mensajería:
//                         lo que escribe el cliente y lo que responde el bot)
//   ConversationInbox     lo que hace el equipo en la pantalla: listar y
//                         filtrar, leer, responder (textos, archivos, notas
//                         de voz, citando), reaccionar, pausar el bot,
//                         etiquetar, enviar un flujo a mano y eliminar el chat
// ---------------------------------------------------------------------------

export interface Agent {
  readonly id: string;
  readonly name: string | null;
}

export class ConversationInbox {
  public constructor(
    private readonly repository: ConversationRepository,
    private readonly recorder: ConversationRecorder,
    private readonly sender: ConversationSender,
    private readonly flows: FlowLauncher,
    private readonly labeler: ContactLabeler
  ) {}

  /** Una página de la bandeja con sus filtros; `nextCursor` trae la siguiente. */
  public async list(tenantId: string, query: ConversationListQuery): Promise<Omit<ConversationListResponse, "canManage">> {
    const rows = await this.repository.inbox(tenantId, { ...inboxQuery(query), limit: CONVERSATIONS_PAGE_SIZE + 1 });
    const conversations = rows.slice(0, CONVERSATIONS_PAGE_SIZE);
    const hasMore = rows.length > CONVERSATIONS_PAGE_SIZE;
    return { conversations, nextCursor: hasMore ? encodeCursor(conversations.at(-1)!) : null };
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

  /**
   * Un chat abierto, en vivo: la primera vez (sin `since`) la última página del
   * hilo; después, solo lo nuevo o cambiado (entregado/leído). Una consulta.
   */
  public async live(tenantId: string, id: string, since?: string): Promise<ConversationLiveResponse> {
    const conversation = await this.get(tenantId, id);
    if (!since) {
      const [page, cursor] = await Promise.all([this.repository.messages(tenantId, id, { limit: 50 }), this.repository.liveCursor(tenantId, id)]);
      return { conversation, messages: page.messages, hasMore: page.hasMore, cursor };
    }
    if (since.length > 64) throw new ValidationError("Marca de actualización inválida.");
    const changes = await this.repository.changesSince(tenantId, id, since);
    return { conversation, messages: changes.messages, hasMore: false, cursor: changes.cursor };
  }

  public async markRead(tenantId: string, id: string): Promise<void> {
    await this.require(tenantId, id);
    await this.repository.markRead(tenantId, id);
  }

  public async setBotEnabled(tenantId: string, id: string, enabled: unknown): Promise<ConversationSummary> {
    if (typeof enabled !== "boolean") throw new ValidationError("Indica si el bot atiende o no este chat.");
    await this.requireLive(tenantId, id);
    await this.repository.setBotEnabled(tenantId, id, enabled);
    return this.get(tenantId, id);
  }

  /**
   * Un asesor responde: uno o varios mensajes en orden (texto, o `{ parts,
   * replyToId }` con archivos, notas de voz y la cita de un mensaje). Pausa el
   * bot en el chat: si siguiera activo, el próximo mensaje del cliente lo
   * contestaría el flujo encima del asesor. Si WhatsApp no acepta alguno,
   * queda en el hilo como fallido con su motivo (como en WhatsApp): no se
   * lanza, para no invitar a reenviarlo duplicado.
   */
  public async sendAgentMessage(tenantId: string, id: string, input: unknown, agent: Agent): Promise<ConversationSummary> {
    const reply = parseAgentReply(input);
    const conversation = await this.requireLive(tenantId, id);
    const quoted = reply.replyToId ? await this.repository.findMessage(tenantId, id, reply.replyToId) : null;
    if (reply.replyToId && !quoted) throw new ValidationError("El mensaje que querías citar ya no está en este chat.");

    const { results } = await this.sender.deliver(tenantId, conversation.connectionId, conversation.phone, toOutbound(reply.parts, conversation.id, quoted?.providerMessageId));
    await this.recorder.recordOutbound(tenantId, conversation.id, results, {
      author: "agent",
      agentId: agent.id,
      ...(agent.name ? { agentName: agent.name } : {}),
      ...(quoted ? { replyToId: quoted.id } : {})
    });
    if (conversation.botEnabled) await this.repository.setBotEnabled(tenantId, id, false);
    return this.get(tenantId, id);
  }

  /**
   * Reacciona a un mensaje del hilo con un emoji (vacío la quita), como en
   * WhatsApp. No pausa el bot: no es una respuesta.
   */
  public async react(tenantId: string, id: string, messageId: string, emoji: unknown, agent: Agent): Promise<void> {
    const reaction = parseReaction(emoji);
    const conversation = await this.requireLive(tenantId, id);
    const target = await this.repository.findMessage(tenantId, id, messageId);
    if (!target) throw new NotFoundError("Ese mensaje ya no está en este chat.");
    if (target.kind === "reaction") throw new ValidationError("No se puede reaccionar a una reacción.");
    if (!target.providerMessageId) throw new ValidationError("WhatsApp aún no confirma ese mensaje: no se le puede reaccionar.");

    const { results } = await this.sender.deliver(tenantId, conversation.connectionId, conversation.phone, [
      { channel: "whatsapp", conversationKey: conversation.id, kind: "reaction", content: reaction, replyToMessageId: target.providerMessageId }
    ]);
    const failed = results.find((result) => !result.ok);
    if (failed) throw new ValidationError(`WhatsApp no aceptó la reacción: ${failed.error ?? "error del proveedor"}.`);
    await this.recorder.recordOutbound(tenantId, conversation.id, results, { author: "agent", agentId: agent.id, ...(agent.name ? { agentName: agent.name } : {}), replyToId: target.id });
  }

  /**
   * Elimina el chat y su historial de la bandeja (el cliente sigue en
   * Contactos y en sus ventas). Si vuelve a escribir, empieza un chat nuevo.
   */
  public async remove(tenantId: string, id: string): Promise<void> {
    if (!(await this.repository.remove(tenantId, id))) throw new NotFoundError("Conversación no encontrada.");
  }

  /**
   * Etiquetas del chat = las de su cliente (Contactos), las mismas que ponen
   * los flujos: un solo catálogo. Un chat sin contacto no se puede etiquetar.
   */
  public async setLabels(tenantId: string, id: string, labelIds: unknown): Promise<ConversationSummary> {
    if (!Array.isArray(labelIds) || !labelIds.every((labelId) => typeof labelId === "string")) {
      throw new ValidationError("labelIds debe ser una lista de identificadores.");
    }
    const conversation = await this.require(tenantId, id);
    if (!conversation.contactId) throw new ValidationError("Este chat no tiene un contacto asociado para etiquetar.");
    await this.labeler.setLabels(tenantId, conversation.contactId, labelIds as string[]);
    return this.get(tenantId, id);
  }

  /** Envía un flujo a mano: corta lo que el cliente estuviera haciendo y lo empieza; el bot queda activo. */
  public async startFlow(tenantId: string, id: string, automationId: unknown): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
    if (typeof automationId !== "string" || !automationId) throw new ValidationError("Elige el flujo que quieres enviar.");
    const conversation = await this.requireLive(tenantId, id);
    if (!conversation.botEnabled) await this.repository.setBotEnabled(tenantId, id, true);
    return this.flows.launch(tenantId, conversation, automationId);
  }

  private async require(tenantId: string, id: string): Promise<Conversation> {
    const conversation = await this.repository.findById(tenantId, id);
    if (!conversation) throw new NotFoundError("Conversación no encontrada.");
    return conversation;
  }

  /** Para lo que sale hacia el cliente o mueve el bot: el número del chat debe seguir existiendo. */
  private async requireLive(tenantId: string, id: string): Promise<Conversation> {
    const conversation = await this.require(tenantId, id);
    if (conversation.connectionDeleted) {
      throw new ValidationError("El número de este chat fue eliminado: puedes leer el historial, pero ya no responder desde él.");
    }
    return conversation;
  }
}
