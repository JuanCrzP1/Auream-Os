import { timerEnvelope, type FlowTimerPayload, type FlowWakeUp } from "../../../contracts/FlowTimerContracts";
import type { FlowTurn } from "./FlowTurn";
import { WHATSAPP_CHANNEL } from "./HandleInboundMessageService";
import type { ConversationLock, ConversationLog, FlowTurnTarget } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// Despertadores de los flujos (FASE C6), del lado de la mensajería:
//
//   flowTimerTask    qué tarea programar para el despertador que pidió el motor
//                    (una por conversación: la nueva reemplaza a la anterior)
//   FlowTimerService lo que pasa cuando vence: con el candado del chat, si el
//                    bot sigue atendiéndolo y su número existe, corre un turno
//                    con el envelope del despertador. El motor descarta solo
//                    los vencidos (la sesión ya avanzó): nunca se duplica nada.
//
// La cola de tareas es otro módulo: la composición conecta las dos orillas.
// ---------------------------------------------------------------------------

export const FLOW_TIMER_TASK_KIND = "flow.timer";

export interface FlowTimerTaskPayload extends Omit<FlowTurnTarget, "tenantId"> {
  readonly timer: FlowTimerPayload;
}

/** Tarea de la cola para un despertador. `groupKey`: la conversación (una pendiente por chat). */
export function flowTimerTask(target: FlowTurnTarget, wakeUp: FlowWakeUp) {
  const payload: FlowTimerTaskPayload = {
    connectionId: target.connectionId,
    phone: target.phone,
    conversationKey: target.conversationKey,
    flowKey: target.flowKey,
    timer: { reason: wakeUp.reason, nodeId: wakeUp.nodeId, revision: wakeUp.revision }
  };
  return {
    tenantId: target.tenantId,
    kind: FLOW_TIMER_TASK_KIND,
    groupKey: flowTimerGroup(target.conversationKey),
    dedupeKey: `${FLOW_TIMER_TASK_KIND}:${target.tenantId}:${target.conversationKey}:${wakeUp.revision}:${wakeUp.reason}`,
    payload: payload as unknown as Readonly<Record<string, unknown>>,
    dueAt: new Date(wakeUp.at)
  };
}

export function flowTimerGroup(conversationKey: string): string {
  return `conversation:${conversationKey}`;
}

/** Lee el payload guardado sin confiar en él. `null` si no es un despertador válido. */
export function readFlowTimerPayload(raw: Readonly<Record<string, unknown>>): FlowTimerTaskPayload | null {
  const text = (key: string) => (typeof raw[key] === "string" && (raw[key] as string).length > 0 ? (raw[key] as string) : null);
  const timer = raw["timer"] as Record<string, unknown> | undefined;
  const connectionId = text("connectionId");
  const phone = text("phone");
  const conversationKey = text("conversationKey");
  const flowKey = text("flowKey");
  if (!connectionId || !phone || !conversationKey || !flowKey || !timer) return null;
  if ((timer["reason"] !== "resume" && timer["reason"] !== "timeout") || typeof timer["nodeId"] !== "string" || typeof timer["revision"] !== "number") return null;
  return { connectionId, phone, conversationKey, flowKey, timer: { reason: timer["reason"], nodeId: timer["nodeId"], revision: timer["revision"] } };
}

export type FlowTimerOutcome = "ran" | "no_chat" | "bot_paused" | "connection_deleted";

export class FlowTimerService {
  public constructor(
    private readonly lock: ConversationLock,
    private readonly conversations: Pick<ConversationLog, "findChat">,
    private readonly turn: FlowTurn,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async fire(tenantId: string, payload: FlowTimerTaskPayload): Promise<FlowTimerOutcome> {
    return this.lock.withLock(`${tenantId}:${payload.conversationKey}`, async () => {
      const chat = await this.conversations.findChat(tenantId, payload.connectionId, payload.phone);
      if (!chat) return "no_chat";
      // Un asesor atiende: el flujo no se mueve. La sesión recuerda la hora y
      // sigue con el próximo mensaje cuando reactiven el bot.
      if (!chat.botEnabled) return "bot_paused";
      if (chat.connectionDeleted) return "connection_deleted";

      await this.turn.run(
        { tenantId, ...payload, conversationId: chat.id },
        timerEnvelope(
          { tenantId, flowKey: payload.flowKey, channel: WHATSAPP_CHANNEL, conversationKey: payload.conversationKey, userKey: payload.phone, receivedAt: this.now().toISOString() },
          payload.timer
        )
      );
      return "ran";
    });
  }
}
