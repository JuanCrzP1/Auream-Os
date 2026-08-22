import type { InboundEnvelope } from "../../contracts/RuntimeContracts";
import type { ExternalEvent, TriggerBinding } from "../../contracts/TriggerContracts";

// ---------------------------------------------------------------------------
// toInboundEnvelope
//
// Responsabilidad única: traducir un evento externo ya vinculado a un flow
// en el envelope que consume el ExecutionOrchestrator.
//
// Es el único punto donde el vocabulario de Connections (evento, conexión)
// se convierte en el vocabulario del motor (envelope, flowKey).
// ---------------------------------------------------------------------------

export function toInboundEnvelope(event: ExternalEvent, binding: TriggerBinding): InboundEnvelope {
  if (event.tenantId !== binding.tenantId) {
    throw new Error(
      `Trigger cruzado entre tenants: evento ${event.tenantId} contra binding ${binding.tenantId}`
    );
  }

  return {
    tenantId: event.tenantId,
    flowKey: binding.flowKey,
    channel: event.channel,
    conversationKey: event.conversationKey,
    userKey: event.userKey,
    messageId: event.eventId,
    payload: event.payload,
    receivedAt: event.occurredAt
  };
}
