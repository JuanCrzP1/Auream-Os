import type { ScheduledMessageAlarm } from "../../../domains/conversations/application/ScheduledMessagePorts";
import type { ScheduledMessageDispatcher } from "../../../domains/conversations/application/ScheduledMessageDispatcher";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import { PermanentTaskError, type ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

// ---------------------------------------------------------------------------
// Mensajes programados ↔ cola de tareas (ninguno conoce al otro):
//
//   SchedulerScheduledMessageAlarm   bandeja → cola: una tarea a la hora del
//                                    mensaje. Si lo reprograman, otra para la
//                                    hora nueva; la vieja suena y no hace nada
//                                    (el despachador mira la hora guardada).
//   ScheduledMessageTaskHandler      cola → bandeja: a la hora, lo envía.
// ---------------------------------------------------------------------------

export const SCHEDULED_MESSAGE_TASK_KIND = "chat.scheduled_message";

/** Pocos intentos: un envío que falla queda a la vista para reintentarlo a mano. */
const MAX_ATTEMPTS = 4;

export class SchedulerScheduledMessageAlarm implements ScheduledMessageAlarm {
  public constructor(private readonly scheduler: TaskScheduler) {}

  public async arm(tenantId: string, conversationId: string, scheduledId: string, sendAt: Date): Promise<void> {
    await this.scheduler.schedule({
      tenantId,
      kind: SCHEDULED_MESSAGE_TASK_KIND,
      groupKey: `chat-scheduled:${conversationId}`,
      dedupeKey: `${SCHEDULED_MESSAGE_TASK_KIND}:${scheduledId}:${sendAt.getTime()}`,
      payload: { scheduledId },
      dueAt: sendAt,
      maxAttempts: MAX_ATTEMPTS
    });
  }
}

export class ScheduledMessageTaskHandler implements TaskHandler {
  public readonly kind = SCHEDULED_MESSAGE_TASK_KIND;

  public constructor(private readonly dispatcher: Pick<ScheduledMessageDispatcher, "fire">) {}

  public async handle(task: ScheduledTask): Promise<void> {
    const scheduledId = task.payload["scheduledId"];
    if (typeof scheduledId !== "string" || !scheduledId) throw new PermanentTaskError("La tarea no dice qué mensaje programado enviar.");
    await this.dispatcher.fire(task.tenantId, scheduledId);
  }
}
