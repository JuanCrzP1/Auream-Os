import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import type { FlowRunResult } from "../../../contracts/FlowTimerContracts";
import type { ConversationLog, DeliveryReport, FlowRunner, FlowTimers, FlowTurnTarget, OutboundDelivery } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// FlowTurn — UN turno de un flujo en una conversación, sea cual sea su origen
// (un mensaje del cliente, un flujo enviado a mano, un despertador vencido):
//
//   1. el motor avanza la sesión
//   2. lo que respondió sale por el número del chat
//   3. queda en la bandeja (enviado o no, con su motivo)
//   4. se programa el despertador que pidió el motor (o se cancelan los viejos)
//
// Quien lo usa pone el candado de la conversación: un turno nunca se cruza
// con otro del mismo chat.
// ---------------------------------------------------------------------------

export interface FlowTurnOutcome {
  readonly result: FlowRunResult;
  readonly report: DeliveryReport;
}

export class FlowTurn {
  public constructor(
    private readonly runner: FlowRunner,
    private readonly delivery: OutboundDelivery,
    private readonly conversations: Pick<ConversationLog, "recordOutbound">,
    private readonly timers: FlowTimers
  ) {}

  public async run(target: FlowTurnTarget & { readonly conversationId: string }, envelope: InboundEnvelope): Promise<FlowTurnOutcome> {
    const result = await this.runner.handle(envelope);
    const report = await this.delivery.deliver(target.tenantId, target.connectionId, target.phone, result.outputMessages);
    await this.conversations.recordOutbound(target.tenantId, target.conversationId, report.results, { author: "bot", flowKey: target.flowKey });
    await this.timers.afterTurn(target, result);
    return { result, report };
  }
}
