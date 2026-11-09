import type { FlowRunResult } from "../../../contracts/FlowTimerContracts";
import type { FlowTimers, FlowTurnTarget } from "../../../domains/messaging/application/ports/MessagingPorts";
import {
  FLOW_TIMER_TASK_KIND,
  flowTimerGroup,
  flowTimerTask,
  readFlowTimerPayload,
  type FlowTimerService
} from "../../../domains/messaging/application/FlowTimerService";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import { PermanentTaskError, type ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

// ---------------------------------------------------------------------------
// Los despertadores de los flujos sobre la cola de tareas. Solo traducen
// entre los dos módulos (ninguno conoce al otro):
//
//   SchedulerFlowTimers   mensajería → cola: tras cada turno, deja programado
//                         el despertador que pidió el motor (uno por chat) o
//                         cancela los que ya no aplican.
//   FlowTimerTaskHandler  cola → mensajería: al vencer, corre el turno.
// ---------------------------------------------------------------------------

export class SchedulerFlowTimers implements FlowTimers {
  public constructor(private readonly scheduler: TaskScheduler) {}

  public async afterTurn(target: FlowTurnTarget, result: FlowRunResult): Promise<void> {
    // Un turno que no cambió la sesión deja intactos los despertadores que ya había.
    if (result.untouched) return;
    if (result.wakeUp) {
      await this.scheduler.replaceInGroup(flowTimerTask(target, result.wakeUp));
      return;
    }
    await this.scheduler.cancelGroup(target.tenantId, flowTimerGroup(target.conversationKey));
  }
}

export class FlowTimerTaskHandler implements TaskHandler {
  public readonly kind = FLOW_TIMER_TASK_KIND;

  public constructor(private readonly timers: FlowTimerService) {}

  public async handle(task: ScheduledTask): Promise<void> {
    const payload = readFlowTimerPayload(task.payload);
    if (!payload) throw new PermanentTaskError("El despertador no trae datos válidos.");
    await this.timers.fire(task.tenantId, payload);
  }
}
