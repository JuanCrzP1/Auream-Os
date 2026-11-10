import type { AdsSyncScheduler } from "../../../domains/ads/application/AdsPorts";
import type { AdsSyncService, SyncWindow } from "../../../domains/ads/application/AdsSyncService";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

// ---------------------------------------------------------------------------
// Meta Ads ↔ cola de tareas. Cada cuenta elegida tiene su tarea `ads.sync`
// (la próxima vuelta la programa la anterior). La clave de idempotencia por
// tramo de 30 minutos evita que dos pedidos seguidos dupliquen la vuelta.
// ---------------------------------------------------------------------------

export const ADS_SYNC_TASK_KIND = "ads.sync";
const BUCKET_MS = 30 * 60_000;

export class SchedulerAdsSync implements AdsSyncScheduler {
  public constructor(private readonly scheduler: TaskScheduler) {}

  public async scheduleSync(tenantId: string, accountId: string, at: Date, window?: SyncWindow): Promise<void> {
    await this.scheduler.schedule({
      tenantId,
      kind: ADS_SYNC_TASK_KIND,
      groupKey: `ads:${accountId}`,
      dedupeKey: window ? `ads.sync:${accountId}:${window.since}:${window.until}` : `ads.sync:${accountId}:${Math.floor(at.getTime() / BUCKET_MS)}`,
      payload: { accountId, ...(window ? { since: window.since, until: window.until } : {}) },
      dueAt: at,
      maxAttempts: 2
    });
  }
}

export class AdsSyncTaskHandler implements TaskHandler {
  public readonly kind = ADS_SYNC_TASK_KIND;

  public constructor(private readonly sync: AdsSyncService) {}

  public async handle(task: ScheduledTask): Promise<void> {
    const accountId = typeof task.payload["accountId"] === "string" ? task.payload["accountId"] : null;
    if (!accountId) return;
    const since = task.payload["since"];
    const until = task.payload["until"];
    await this.sync.sync(task.tenantId, accountId, typeof since === "string" && typeof until === "string" ? { since, until } : undefined);
  }
}
