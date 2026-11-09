import type { StartFlowService } from "./StartFlowService";
import type { ConversationLog } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// Iniciar un flujo para un teléfono por un número de la cuenta, aunque el
// cliente nunca haya escrito (p. ej. desde un webhook de entrada): abre su
// chat en ese número y lo envía como el envío a mano de la bandeja (termina
// el recorrido en curso; mismo candado; lo enviado queda en el chat).
// ---------------------------------------------------------------------------

export class StartFlowForContactService {
  public constructor(
    private readonly chats: Pick<ConversationLog, "openChat">,
    private readonly starter: Pick<StartFlowService, "launch">
  ) {}

  public async launch(
    tenantId: string,
    target: { readonly connectionId: string; readonly phone: string; readonly contactId: string | null },
    automationId: string
  ): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
    const chat = await this.chats.openChat(tenantId, target.connectionId, target.phone, target.contactId);
    return this.starter.launch(tenantId, { id: chat.id, connectionId: target.connectionId, phone: target.phone }, automationId);
  }
}
