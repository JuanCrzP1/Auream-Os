import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import { alignWakeUpToDelivery, type FlowRunResult } from "../../../contracts/FlowTimerContracts";
import type { ConversationLog, DeliveryReport, FlowRunner, FlowTimers, FlowTurnTarget, OutboundDelivery } from "./ports/MessagingPorts";
import { NO_JOURNAL, turnRecord, type TurnJournal } from "./FlowTurnJournal";

// ---------------------------------------------------------------------------
// FlowTurn — UN turno de un flujo en una conversación, sea cual sea su origen
// (un mensaje del cliente, un flujo enviado a mano, un despertador vencido):
//
//   1. el motor avanza la sesión
//   2. lo que respondió sale por el número del chat y queda en la bandeja AL
//      MOMENTO de salir cada mensaje (enviado o no, con su motivo): el chat se
//      ve en vivo, no al terminar el turno
//   3. se programa el despertador que pidió el motor (o se cancelan los viejos).
//      Una espera relativa («3 minutos», una pausa, un tiempo máximo) cuenta
//      desde que salió de verdad el último mensaje: si la entrega tardó más de
//      lo planeado (envíos, red), el despertador se corre exactamente eso
//
//   4. lo que guardaron los bloques y es un campo del cliente queda en el
//      cliente (`TurnFields`), en paralelo con la entrega
//
// Cada turno (también uno que revienta) queda en el historial interno
// (`TurnJournal`): si anotarlo o guardar los campos falla, el turno no se entera.
//
// Quien lo usa pone el candado de la conversación: un turno nunca se cruza
// con otro del mismo chat.
// ---------------------------------------------------------------------------

/** Lo que guardaron los bloques del turno, para pasar al cliente lo que sea un campo definido. */
export interface TurnFields {
  afterTurn(tenantId: string, envelope: InboundEnvelope, patch: Readonly<Record<string, unknown>>): Promise<void>;
}

const NO_FIELDS: TurnFields = { afterTurn: async () => undefined };

export interface FlowTurnOutcome {
  readonly result: FlowRunResult;
  readonly report: DeliveryReport;
}

export class FlowTurn {
  public constructor(
    private readonly runner: FlowRunner,
    private readonly delivery: OutboundDelivery,
    private readonly conversations: Pick<ConversationLog, "recordOutbound">,
    private readonly timers: FlowTimers,
    private readonly now: () => Date = () => new Date(),
    private readonly journal: TurnJournal = NO_JOURNAL,
    private readonly fields: TurnFields = NO_FIELDS
  ) {}

  public async run(target: FlowTurnTarget & { readonly conversationId: string }, envelope: InboundEnvelope): Promise<FlowTurnOutcome> {
    const startedAt = this.now();
    try {
      const outcome = await this.turn(target, envelope);
      await this.note(turnRecord(target, envelope, { startedAt, finishedAt: this.now() }, outcome));
      return { result: outcome.result, report: outcome.report };
    } catch (error) {
      await this.note(turnRecord(target, envelope, { startedAt, finishedAt: this.now() }, { error }));
      throw error;
    }
  }

  private async note(entry: Parameters<TurnJournal["record"]>[0]): Promise<void> {
    await this.journal.record(entry).catch(() => undefined);
  }

  private async turn(target: FlowTurnTarget & { readonly conversationId: string }, envelope: InboundEnvelope) {
    const result = await this.runner.handle(envelope);
    const patch = result.contextPatch ?? {};
    const saving = Object.keys(patch).length > 0 ? this.fields.afterTurn(target.tenantId, envelope, patch).catch(() => undefined) : Promise.resolve();
    const report = await this.delivery.deliver(target.tenantId, target.connectionId, target.phone, result.outputMessages, async (sent) => {
      // Un aviso al equipo (Notificación) no es parte del chat del cliente.
      if (sent.message.recipient) return;
      await this.conversations.recordOutbound(target.tenantId, target.conversationId, [sent], { author: "bot", flowKey: target.flowKey });
    });
    const wakeUp = result.wakeUp ? alignWakeUpToDelivery(result.wakeUp, this.now()) : undefined;
    await this.timers.afterTurn(target, wakeUp === result.wakeUp ? result : { ...result, wakeUp });
    await saving;
    return { result, report, ...(wakeUp ? { wakeUpAt: wakeUp.at } : {}) };
  }
}
