import type { InboundChannelMessage, InboundOutcome } from "../../../contracts/InboundMessageContracts";
import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import type {
  ConversationLog,
  ConversationLock,
  FlowRunner,
  InboundContacts,
  InboundMessageLog,
  LiveSessions,
  OutboundDelivery,
  TriggerRouter
} from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// HandleInboundMessageService — un mensaje de un cliente a un número de la
// cuenta, de punta a punta:
//
//   1. registro: si ya se recibió (el proveedor puede repetir), se ignora
//   2. candado por conversación: los mensajes de un cliente, de a uno
//   3. contacto: se identifica (o se crea con su nombre de WhatsApp)
//   4. bandeja: el mensaje queda en su chat; si un asesor pausó el bot, aquí termina
//   5. flujo: si está dentro de uno, lo continúa; si no, el disparador decide
//   6. motor: corre el flujo con la sesión guardada
//   7. respuestas: se envían por el mismo número y quedan en el chat
//   8. registro: queda qué pasó (flujo, enviados, error)
//
// Cada paso es un puerto: este servicio solo coordina. Nunca lanza: un fallo
// queda en el registro y no tumba al resto.
// ---------------------------------------------------------------------------

export const WHATSAPP_CHANNEL = "whatsapp";

/** Conversación = número de la cuenta + cliente (el mismo cliente en dos números son dos). */
export function conversationKeyFor(connectionId: string, phone: string): string {
  return `${connectionId}:${phone}`;
}

export interface InboundResult {
  readonly outcome: InboundOutcome | "duplicate";
  readonly flowKey?: string;
  readonly sent?: number;
  readonly error?: string;
}

export class HandleInboundMessageService {
  public constructor(
    private readonly log: InboundMessageLog,
    private readonly lock: ConversationLock,
    private readonly contacts: InboundContacts,
    private readonly sessions: LiveSessions,
    private readonly triggers: TriggerRouter,
    private readonly runner: FlowRunner,
    private readonly delivery: OutboundDelivery,
    private readonly conversations: ConversationLog
  ) {}

  public async execute(tenantId: string, message: InboundChannelMessage): Promise<InboundResult> {
    if (!(await this.log.claim(tenantId, message))) return { outcome: "duplicate" };

    const conversationKey = conversationKeyFor(message.connectionId, message.phone);
    const finish = async (outcome: InboundOutcome, detail: { flowKey?: string; sent?: number; error?: string; events?: ReadonlyArray<string> } = {}) => {
      await this.log.finish(tenantId, message.connectionId, message.providerMessageId, outcome, detail).catch(() => undefined);
      return { outcome, ...detail };
    };

    try {
      return await this.lock.withLock(`${tenantId}:${conversationKey}`, async () => {
        const contact = await this.contacts.identify(tenantId, message.phone, message.senderName);
        const conversation = await this.conversations.recordInbound(tenantId, message, contact.contactId);
        if (!conversation.botEnabled) return finish("bot_paused");

        const liveFlow = await this.sessions.liveFlowOf(tenantId, conversationKey);
        const route = liveFlow
          ? null
          : await this.triggers.route(tenantId, message.connectionId, { text: message.text, isNewContact: contact.isNew, fromAd: message.fromAd });
        const flowKey = liveFlow ?? route?.flowKey ?? null;
        if (!flowKey) return finish("no_trigger");

        const result = await this.runner.handle(toEnvelope(tenantId, flowKey, conversationKey, message));
        const report = await this.delivery.deliver(tenantId, message.connectionId, message.phone, result.outputMessages);
        await this.conversations.recordOutbound(tenantId, conversation.id, report.results, { author: "bot", flowKey });
        return finish(liveFlow ? "flow_continued" : "flow_started", {
          flowKey,
          sent: report.sent,
          ...(report.failures.length ? { error: report.failures.join(" · ").slice(0, 500) } : {}),
          events: result.domainEvents
        });
      });
    } catch (error) {
      return finish("failed", { error: error instanceof Error ? error.message.slice(0, 500) : "Error desconocido" });
    }
  }
}

/** Del mensaje del canal a lo que entiende el motor. */
export function toEnvelope(tenantId: string, flowKey: string, conversationKey: string, message: InboundChannelMessage): InboundEnvelope {
  return {
    tenantId,
    flowKey,
    channel: WHATSAPP_CHANNEL,
    conversationKey,
    userKey: message.phone,
    messageId: message.providerMessageId,
    payload: {
      text: message.text,
      messageType: message.kind,
      ...(message.replyId ? { optionId: message.replyId } : {}),
      ...(message.media ? { mediaUrl: message.media.url, ...(message.media.mimeType ? { mediaType: message.media.mimeType } : {}) } : {}),
      ...(message.senderName ? { senderName: message.senderName } : {})
    },
    receivedAt: message.sentAt
  };
}
