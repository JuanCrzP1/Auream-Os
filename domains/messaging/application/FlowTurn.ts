import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import { alignWakeUpToDelivery, type FlowRunResult } from "../../../contracts/FlowTimerContracts";
import type { FlowCatalog } from "../../connections/application/ports/FlowCatalog";
import type { ConversationLog, DeliveryReport, FlowRunner, FlowTimers, FlowTurnTarget, OutboundDelivery } from "./ports/MessagingPorts";
import { NO_JOURNAL, turnRecord, type TurnJournal } from "./FlowTurnJournal";
import { nextHandoff } from "./flowHandoff";

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
//   5. «Ir a otro flujo»: si el flujo terminó pasando al cliente a otro, ese
//      otro arranca AHORA, en el mismo turno y con los datos guardados
//      (`flowHandoff.ts` decide si se puede: flujo activo, no el mismo, como
//      mucho 5 saltos seguidos). Lo que envíen ambos cuenta junto.
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
    private readonly fields: TurnFields = NO_FIELDS,
    /** Los flujos de la cuenta, para «Ir a otro flujo». Ausente: el salto no se hace (queda anotado). */
    private readonly flows?: FlowCatalog
  ) {}

  public async run(target: FlowTurnTarget & { readonly conversationId: string }, envelope: InboundEnvelope): Promise<FlowTurnOutcome> {
    let outcome = await this.single(target, envelope);
    let current: { target: FlowTurnTarget; envelope: InboundEnvelope } = { target, envelope };
    while (outcome.result.handoff) {
      const step = await nextHandoff(this.flows, current.target, current.envelope, outcome.result.handoff, this.now());
      if (step.kind === "refused") {
        outcome = { ...outcome, result: { ...outcome.result, domainEvents: [...outcome.result.domainEvents, step.event] } };
        break;
      }
      current = { target: step.target, envelope: step.envelope };
      outcome = joined(outcome, await this.single({ ...step.target, conversationId: target.conversationId }, step.envelope));
    }
    return outcome;
  }

  private async single(target: FlowTurnTarget & { readonly conversationId: string }, envelope: InboundEnvelope): Promise<FlowTurnOutcome> {
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

/** Dos flujos en un mismo turno: lo que envió cada uno cuenta junto; la sesión es la del último. */
function joined(first: FlowTurnOutcome, second: FlowTurnOutcome): FlowTurnOutcome {
  return {
    result: { ...second.result, domainEvents: [...first.result.domainEvents, ...second.result.domainEvents] },
    report: { sent: first.report.sent + second.report.sent, failures: [...first.report.failures, ...second.report.failures], results: [...first.report.results, ...second.report.results] }
  };
}
