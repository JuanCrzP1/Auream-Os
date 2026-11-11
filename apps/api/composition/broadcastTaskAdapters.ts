import type { BroadcastTicker } from "../../../domains/broadcasts/application/BroadcastPorts";
import type { BroadcastDispatcher } from "../../../domains/broadcasts/application/BroadcastDispatcher";
import type { BroadcastLauncher } from "../../../domains/broadcasts/application/BroadcastLauncher";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";

// ---------------------------------------------------------------------------
// Difusiones ↔ cola de tareas.
//   broadcast.start      a su hora: armar la lista y arrancar
//   broadcast.tick       un envío por un número; UNA cadena por número
//                        (cada eslabón reemplaza al anterior de su grupo)
//   broadcast.decide     fin de la prueba A/B
//   broadcast.follow_up  el segundo envío
// Lo que vence en segundos despierta ya al trabajador; lo demás, su despertador.
// ---------------------------------------------------------------------------

export const BROADCAST_TASKS = { start: "broadcast.start", tick: "broadcast.tick", decide: "broadcast.decide", followUp: "broadcast.follow_up" } as const;

const groupOf = (broadcastId: string) => `broadcast:${broadcastId}`;
const chainOf = (broadcastId: string, connectionId: string) => `broadcast:${broadcastId}:${connectionId}`;

export class SchedulerBroadcastTicker implements BroadcastTicker {
  public constructor(
    private readonly scheduler: TaskScheduler,
    private readonly sql: SqlClient
  ) {}

  public async start(tenantId: string, broadcastId: string, at: Date): Promise<void> {
    await this.once(tenantId, BROADCAST_TASKS.start, broadcastId, at);
  }

  public async tick(tenantId: string, broadcastId: string, connectionId: string, at: Date): Promise<void> {
    await this.scheduler.replaceInGroup({
      tenantId,
      kind: BROADCAST_TASKS.tick,
      groupKey: chainOf(broadcastId, connectionId),
      dedupeKey: `${BROADCAST_TASKS.tick}:${broadcastId}:${connectionId}:${at.getTime()}`,
      payload: { broadcastId, connectionId },
      dueAt: at
    });
  }

  public async decide(tenantId: string, broadcastId: string, at: Date): Promise<void> {
    await this.once(tenantId, BROADCAST_TASKS.decide, broadcastId, at);
  }

  public async followUp(tenantId: string, broadcastId: string, at: Date): Promise<void> {
    await this.once(tenantId, BROADCAST_TASKS.followUp, broadcastId, at);
  }

  public async stop(tenantId: string, broadcastId: string, connectionIds: ReadonlyArray<string>): Promise<void> {
    await this.scheduler.cancelGroup(tenantId, groupOf(broadcastId));
    for (const connectionId of connectionIds) await this.scheduler.cancelGroup(tenantId, chainOf(broadcastId, connectionId));
  }

  public async next(tenantId: string, broadcastId: string): Promise<Date | null> {
    const result = await this.sql.query<{ due_at: Date | null }>(
      `select min(due_at) as due_at from scheduled_tasks
        where tenant_id = $1 and status = 'pending' and kind = any($3::text[]) and (group_key = $2 or group_key like $2 || ':%')`,
      [tenantId, groupOf(broadcastId), [BROADCAST_TASKS.start, BROADCAST_TASKS.tick]]
    );
    const due = result.rows[0]?.due_at;
    return due ? new Date(due) : null;
  }

  private async once(tenantId: string, kind: string, broadcastId: string, at: Date): Promise<void> {
    await this.scheduler.schedule({ tenantId, kind, groupKey: groupOf(broadcastId), dedupeKey: `${kind}:${broadcastId}:${at.getTime()}`, payload: { broadcastId }, dueAt: at });
  }
}

const text = (task: ScheduledTask, key: string) => (typeof task.payload[key] === "string" ? (task.payload[key] as string) : null);

/** Los cuatro manejadores de la cola para las difusiones. */
export function broadcastTaskHandlers(launcher: BroadcastLauncher, dispatcher: BroadcastDispatcher): TaskHandler[] {
  const byBroadcast = (kind: string, run: (tenantId: string, broadcastId: string) => Promise<void>): TaskHandler => ({
    kind,
    handle: async (task) => {
      const broadcastId = text(task, "broadcastId");
      if (broadcastId) await run(task.tenantId, broadcastId);
    }
  });
  return [
    byBroadcast(BROADCAST_TASKS.start, (tenantId, id) => launcher.start(tenantId, id)),
    byBroadcast(BROADCAST_TASKS.decide, (tenantId, id) => launcher.decide(tenantId, id)),
    byBroadcast(BROADCAST_TASKS.followUp, (tenantId, id) => launcher.followUp(tenantId, id)),
    {
      kind: BROADCAST_TASKS.tick,
      handle: async (task) => {
        const broadcastId = text(task, "broadcastId");
        const connectionId = text(task, "connectionId");
        if (broadcastId && connectionId) await dispatcher.tick(task.tenantId, broadcastId, connectionId);
      }
    }
  ];
}
