import {
  CONVERSATION_FILTERS,
  CONVERSATIONS_PAGE_SIZE,
  MAX_AGENT_MESSAGE_LENGTH,
  MAX_LABEL_FILTERS,
  type ConversationFilter,
  type ConversationListQuery,
  type ConversationListResponse,
  type ConversationLiveResponse,
  type ConversationMessagesResponse,
  type ConversationSummary
} from "../../../contracts/ConversationContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { Conversation } from "../domain/Conversation";
import type { ConversationRepository, InboxCursor, InboxQuery } from "./ConversationRepository";
import { ConversationRecorder } from "./ConversationRecorder";
import type { ContactLabeler, ConversationSender, FlowLauncher } from "./ports/ConversationPorts";

// El guardado de mensajes vive en `ConversationRecorder.ts`; se re-exporta por compatibilidad.
export { ConversationRecorder };

// ---------------------------------------------------------------------------
// La bandeja de Conversaciones.
//
//   ConversationRecorder  guarda cada mensaje del hilo (lo usa la mensajería:
//                         lo que escribe el cliente y lo que responde el bot)
//   ConversationInbox     lo que hace el equipo en la pantalla: listar y
//                         filtrar, leer, responder, pausar el bot, etiquetar
//                         y enviar un flujo a mano
// ---------------------------------------------------------------------------

/** El cursor viaja opaco (base64url): la web solo lo devuelve tal cual. */
function encodeCursor(summary: ConversationSummary): string {
  const cursor: InboxCursor = { activityAt: summary.lastMessageAt ?? summary.createdAt, id: summary.id };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(raw: string): InboxCursor {
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<InboxCursor>;
    if (typeof value.activityAt === "string" && !Number.isNaN(Date.parse(value.activityAt)) && typeof value.id === "string" && value.id.length <= 64) {
      return { activityAt: value.activityAt, id: value.id };
    }
  } catch {
    // cae al error de abajo
  }
  throw new ValidationError("La página pedida no es válida. Vuelve a cargar la bandeja.");
}

function isoDate(value: string | undefined, label: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) throw new ValidationError(`La fecha «${label}» no es válida.`);
  return new Date(time).toISOString();
}

/** Filtros de la bandeja validados (lo que llega de la URL es texto libre). */
function inboxQuery(query: ConversationListQuery): Omit<InboxQuery, "limit"> {
  const filter: ConversationFilter = query.filter && CONVERSATION_FILTERS.includes(query.filter) ? query.filter : "all";
  const labelIds = [...new Set((query.labelIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (labelIds.length > MAX_LABEL_FILTERS) throw new ValidationError(`Filtra por hasta ${MAX_LABEL_FILTERS} etiquetas a la vez.`);
  if (labelIds.some((id) => id.length > 64)) throw new ValidationError("Una de las etiquetas no es válida.");
  const from = isoDate(query.from, "desde");
  const to = isoDate(query.to, "hasta");
  if (from && to && from >= to) throw new ValidationError("La fecha «desde» debe ser anterior a «hasta».");
  const search = query.search?.trim().slice(0, 80);
  return {
    filter,
    ...(search ? { search } : {}),
    ...(query.connectionId ? { connectionId: query.connectionId } : {}),
    ...(labelIds.length ? { labelIds } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(query.cursor ? { after: decodeCursor(query.cursor) } : {})
  };
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
    private readonly flows: FlowLauncher,
    private readonly labeler: ContactLabeler
  ) {}

  /** Una página de la bandeja con sus filtros; `nextCursor` trae la siguiente. */
  public async list(tenantId: string, query: ConversationListQuery): Promise<ConversationListResponse> {
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
   * Un asesor responde. Pausa el bot en el chat: si siguiera activo, el
   * próximo mensaje del cliente lo contestaría el flujo encima del asesor.
   * Si WhatsApp no lo acepta, queda en el hilo como fallido con su motivo
   * (como en WhatsApp): no se lanza, para no invitar a reenviarlo duplicado.
   */
  public async sendAgentMessage(tenantId: string, id: string, text: unknown, agent: Agent): Promise<ConversationSummary> {
    const body = typeof text === "string" ? text.trim() : "";
    if (!body) throw new ValidationError("Escribe un mensaje.");
    if (body.length > MAX_AGENT_MESSAGE_LENGTH) throw new ValidationError(`El mensaje admite hasta ${MAX_AGENT_MESSAGE_LENGTH} caracteres.`);
    const conversation = await this.requireLive(tenantId, id);

    const { results } = await this.sender.deliver(tenantId, conversation.connectionId, conversation.phone, [
      { channel: "whatsapp", conversationKey: conversation.id, content: body }
    ]);
    await this.recorder.recordOutbound(tenantId, conversation.id, results, { author: "agent", agentId: agent.id, ...(agent.name ? { agentName: agent.name } : {}) });
    if (conversation.botEnabled) await this.repository.setBotEnabled(tenantId, id, false);
    return this.get(tenantId, id);
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
