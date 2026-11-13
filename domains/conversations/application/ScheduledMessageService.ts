import { randomUUID } from "node:crypto";
import { MAX_SCHEDULED_PER_CHAT, type ScheduledMessage, type ScheduledMessagesResponse } from "../../../contracts/ScheduledMessageContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { CANCELLABLE, cancelIfRepliedOf, resolveSendAt, SENDABLE, type StoredScheduledMessage } from "../domain/ScheduledMessage";
import { parseAgentReply } from "./AgentReply";
import type { ConversationRepository } from "./ConversationRepository";
import type { ScheduledMessageDispatcher } from "./ScheduledMessageDispatcher";
import type { BusinessTimeZone, ScheduledMessageAlarm, ScheduledMessageRepository } from "./ScheduledMessagePorts";

// ---------------------------------------------------------------------------
// Mensajes programados de un chat: lo que hace el equipo en la pantalla.
// Cada cambio responde con los programados abiertos del chat (lo que la
// pantalla muestra), con la zona horaria del negocio. Todo filtra por cuenta y
// por chat: un id de otro chat u otra cuenta «no existe».
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

export class ScheduledMessageService {
  public constructor(
    private readonly repository: ScheduledMessageRepository,
    private readonly chats: Pick<ConversationRepository, "findById">,
    private readonly dispatcher: Pick<ScheduledMessageDispatcher, "sendNow">,
    private readonly alarm: ScheduledMessageAlarm,
    private readonly timeZone: BusinessTimeZone,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async list(tenantId: string, conversationId: string): Promise<ScheduledMessagesResponse> {
    await this.requireChat(tenantId, conversationId, false);
    return this.view(tenantId, conversationId);
  }

  public async schedule(tenantId: string, conversationId: string, input: unknown, authorId: string): Promise<ScheduledMessagesResponse> {
    const body = record(input);
    await this.requireChat(tenantId, conversationId, true);
    const { parts } = parseAgentReply({ parts: body["parts"] });
    const sendAt = resolveSendAt(body, await this.timeZone.of(tenantId), this.now());
    const cancelIfReplied = cancelIfRepliedOf(body["cancelIfReplied"]);
    if ((await this.repository.countPending(tenantId, conversationId)) >= MAX_SCHEDULED_PER_CHAT) {
      throw new ValidationError(`Este chat ya tiene ${MAX_SCHEDULED_PER_CHAT} mensajes programados. Envía o cancela alguno antes.`);
    }
    const id = randomUUID();
    await this.repository.insert({ id, tenantId, conversationId, parts, sendAt, cancelIfReplied, authorId });
    await this.alarm.arm(tenantId, conversationId, id, sendAt);
    return this.view(tenantId, conversationId);
  }

  public async update(tenantId: string, conversationId: string, scheduledId: string, input: unknown): Promise<ScheduledMessagesResponse> {
    const body = record(input);
    await this.requireChat(tenantId, conversationId, true);
    const current = await this.requireMessage(tenantId, conversationId, scheduledId);
    if (current.status !== "pending") throw new ValidationError("Solo se puede editar un mensaje que aún no sale.");
    const parts = body["parts"] === undefined ? current.parts : parseAgentReply({ parts: body["parts"] }).parts;
    const timeChanged = body["date"] !== undefined || body["time"] !== undefined;
    const sendAt = timeChanged ? resolveSendAt(body, await this.timeZone.of(tenantId), this.now()) : new Date(current.sendAt);
    const cancelIfReplied = body["cancelIfReplied"] === undefined ? current.cancelIfReplied : cancelIfRepliedOf(body["cancelIfReplied"]);
    if (!(await this.repository.update(tenantId, scheduledId, { parts, sendAt, cancelIfReplied, armedAt: this.now() }))) {
      throw new ValidationError("Ese mensaje ya salió o se canceló.");
    }
    if (sendAt.getTime() !== Date.parse(current.sendAt)) await this.alarm.arm(tenantId, conversationId, scheduledId, sendAt);
    return this.view(tenantId, conversationId);
  }

  /** «Enviar ahora» (pendiente) o «Reintentar» / «Enviar igual» (no salió). */
  public async sendNow(tenantId: string, conversationId: string, scheduledId: string): Promise<ScheduledMessagesResponse> {
    await this.requireChat(tenantId, conversationId, true);
    const message = await this.requireMessage(tenantId, conversationId, scheduledId);
    if (!SENDABLE.includes(message.status)) throw new ValidationError(message.status === "sending" ? "Ese mensaje se está enviando en este momento." : "Ese mensaje ya salió o se canceló.");
    const outcome = await this.dispatcher.sendNow(message, SENDABLE);
    if (!outcome) throw new ValidationError("Ese mensaje ya se está enviando.");
    if (outcome.status === "failed") throw new ValidationError(`No se pudo enviar: ${outcome.error ?? "error de WhatsApp"}`);
    return this.view(tenantId, conversationId);
  }

  /** Cancelar uno pendiente o descartar uno que no salió. */
  public async cancel(tenantId: string, conversationId: string, scheduledId: string): Promise<ScheduledMessagesResponse> {
    await this.requireChat(tenantId, conversationId, false);
    const message = await this.requireMessage(tenantId, conversationId, scheduledId);
    if (message.status === "sending") throw new ValidationError("Ese mensaje se está enviando en este momento.");
    if (!(await this.repository.cancel(tenantId, scheduledId, CANCELLABLE, this.now()))) throw new ValidationError("Ese mensaje ya salió o se canceló.");
    return this.view(tenantId, conversationId);
  }

  private async view(tenantId: string, conversationId: string): Promise<ScheduledMessagesResponse> {
    const [messages, timeZone] = await Promise.all([this.repository.open(tenantId, conversationId), this.timeZone.of(tenantId)]);
    return { messages: messages.map(toView), timeZone };
  }

  /** El chat debe existir; para programar o enviar, su número también. */
  private async requireChat(tenantId: string, conversationId: string, live: boolean): Promise<void> {
    const chat = UUID.test(conversationId) ? await this.chats.findById(tenantId, conversationId) : null;
    if (!chat) throw new NotFoundError("Conversación no encontrada.");
    if (live && chat.connectionDeleted) throw new ValidationError("El número de este chat fue eliminado: ya no se puede enviar desde él.");
  }

  private async requireMessage(tenantId: string, conversationId: string, scheduledId: string): Promise<StoredScheduledMessage> {
    const message = UUID.test(scheduledId) ? await this.repository.find(tenantId, scheduledId) : null;
    if (!message || message.conversationId !== conversationId || message.status === "sent" || message.status === "cancelled") {
      throw new NotFoundError("Ese mensaje programado ya no existe.");
    }
    return message;
  }
}

function toView(message: StoredScheduledMessage): ScheduledMessage {
  const { id, conversationId, parts, sendAt, cancelIfReplied, status, error, authorId, authorName, createdAt } = message;
  return { id, conversationId, parts, sendAt, cancelIfReplied, status, error, authorId, authorName, createdAt };
}
