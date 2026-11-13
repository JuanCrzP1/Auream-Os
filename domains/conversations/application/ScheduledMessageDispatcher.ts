import type { ScheduledMessageStatus } from "../../../contracts/ScheduledMessageContracts";
import { CLIENT_REPLIED, clientRepliedSince, isStaleSending, NOT_CONFIRMED, type StoredScheduledMessage } from "../domain/ScheduledMessage";
import { toOutbound } from "./AgentReply";
import type { ConversationRecorder } from "./ConversationRecorder";
import type { ConversationRepository } from "./ConversationRepository";
import type { ConversationSender } from "./ports/ConversationPorts";
import type { ScheduledMessageRepository, ScheduledOutcome } from "./ScheduledMessagePorts";

// ---------------------------------------------------------------------------
// Envía un mensaje programado: a su hora (la cola) o ya («Enviar ahora»,
// «Reintentar»). Sale como mensaje del asesor que lo programó, por el número
// del chat, y queda en el hilo. NO toma el chat ni pausa el bot: un
// recordatorio no le cambia la atención a nadie.
//
// Nunca se envía dos veces: se toma de forma atómica (`sending`) antes de
// enviar. Si algo falla ANTES de enviar, vuelve a como estaba y la cola lo
// reintenta; si falla DURANTE el envío, queda fallido («revisa el chat antes
// de reintentar») en vez de arriesgar un duplicado.
// ---------------------------------------------------------------------------

/** Margen para una tarea que suena un poco antes de la hora guardada. */
const EARLY_TOLERANCE_MS = 5_000;

export class ScheduledMessageDispatcher {
  public constructor(
    private readonly repository: ScheduledMessageRepository,
    private readonly chats: Pick<ConversationRepository, "findById">,
    private readonly sender: ConversationSender,
    private readonly recorder: Pick<ConversationRecorder, "recordOutbound">,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** La cola, a la hora. Idempotente: lo ya resuelto, cancelado o reprogramado más tarde no se toca. */
  public async fire(tenantId: string, scheduledId: string): Promise<void> {
    const message = await this.repository.find(tenantId, scheduledId);
    if (!message) return;
    if (message.status === "sending") {
      if (isStaleSending(message, this.now())) await this.repository.finish(tenantId, message.id, { status: "failed", error: NOT_CONFIRMED }, this.now());
      // Otro proceso lo está enviando: se revisa en el próximo intento de la cola.
      else throw new Error("El mensaje programado se está enviando; se revisa de nuevo.");
      return;
    }
    if (message.status !== "pending") return;
    // Lo reprogramaron para más tarde: lo envía la tarea de su nueva hora.
    if (Date.parse(message.sendAt) > this.now().getTime() + EARLY_TOLERANCE_MS) return;
    await this.dispatch(message, ["pending"], true);
  }

  /** «Enviar ahora» o «Reintentar»: sin esperar su hora y aunque el cliente haya respondido. `null`: otro ya lo tomó. */
  public async sendNow(message: StoredScheduledMessage, from: ReadonlyArray<ScheduledMessageStatus>): Promise<ScheduledOutcome | null> {
    return this.dispatch(message, from, false);
  }

  private async dispatch(message: StoredScheduledMessage, from: ReadonlyArray<ScheduledMessageStatus>, respectReply: boolean): Promise<ScheduledOutcome | null> {
    const claimed = await this.repository.claim(message.tenantId, message.id, from, this.now());
    if (!claimed) return null;
    let attempted = false;
    try {
      const outcome = await this.deliver(claimed, respectReply, () => (attempted = true));
      await this.repository.finish(claimed.tenantId, claimed.id, outcome, this.now());
      return outcome;
    } catch (error) {
      if (!attempted) {
        await this.repository.release(claimed.tenantId, claimed.id, message.status);
        throw error;
      }
      const outcome: ScheduledOutcome = { status: "failed", error: NOT_CONFIRMED };
      await this.repository.finish(claimed.tenantId, claimed.id, outcome, this.now());
      return outcome;
    }
  }

  private async deliver(message: StoredScheduledMessage, respectReply: boolean, onAttempt: () => void): Promise<ScheduledOutcome> {
    const chat = await this.chats.findById(message.tenantId, message.conversationId);
    if (!chat) return { status: "failed", error: "El chat ya no existe." };
    if (chat.connectionDeleted) return { status: "failed", error: "El número de este chat fue eliminado." };
    if (respectReply && message.cancelIfReplied && clientRepliedSince(message, await this.repository.lastInboundAt(message.tenantId, chat.id))) {
      return { status: "skipped", error: CLIENT_REPLIED };
    }
    onAttempt();
    const { results } = await this.sender.deliver(message.tenantId, chat.connectionId, chat.phone, toOutbound(message.parts, chat.id));
    // Nada salió (p. ej. el número está desconectado): queda fallido con el motivo, sin ensuciar el hilo.
    if (!results.some((result) => result.ok)) return { status: "failed", error: (results[0]?.error ?? "WhatsApp no aceptó el mensaje.").slice(0, 300) };
    await this.recorder.recordOutbound(message.tenantId, chat.id, results, { author: "agent", ...(message.authorId ? { agentId: message.authorId } : {}) });
    return { status: "sent", error: null };
  }
}
