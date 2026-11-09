import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import type { FlowCatalog } from "../../connections/application/ports/FlowCatalog";
import { conversationKeyFor, WHATSAPP_CHANNEL } from "./HandleInboundMessageService";
import type { FlowTurn } from "./FlowTurn";
import type { ConversationLock, SessionControl } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// Enviar un flujo a mano desde la bandeja (como en Leona): termina el
// recorrido en que estuviera el cliente y empieza el flujo elegido desde su
// inicio; lo que el flujo envía sale por el número del chat y queda en él.
// Mismo candado por conversación que los mensajes entrantes.
// ---------------------------------------------------------------------------

export class StartFlowService {
  public constructor(
    private readonly flows: FlowCatalog,
    private readonly lock: ConversationLock,
    private readonly sessions: SessionControl,
    private readonly turn: FlowTurn,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async launch(
    tenantId: string,
    conversation: { readonly id: string; readonly connectionId: string; readonly phone: string },
    automationId: string
  ): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
    const [flow] = await this.flows.findMany(tenantId, [automationId]);
    if (!flow) throw new NotFoundError("Ese flujo no existe en tu cuenta.");
    if (flow.archived) throw new ValidationError(`«${flow.name}» está archivado: restáuralo para enviarlo.`);

    const conversationKey = conversationKeyFor(conversation.connectionId, conversation.phone);
    return this.lock.withLock(`${tenantId}:${conversationKey}`, async () => {
      await this.sessions.endLive(tenantId, conversationKey);
      const at = this.now().toISOString();
      const { report } = await this.turn.run(
        { tenantId, connectionId: conversation.connectionId, phone: conversation.phone, conversationKey, flowKey: flow.key, conversationId: conversation.id },
        {
          tenantId,
          flowKey: flow.key,
          channel: WHATSAPP_CHANNEL,
          conversationKey,
          userKey: conversation.phone,
          messageId: `manual:${conversation.id}:${at}`,
          payload: { text: "", manual: true },
          receivedAt: at
        }
      );
      return { flowName: flow.name, sent: report.sent, failed: report.results.filter((r) => !r.ok).length };
    });
  }
}
