import type { CampaignServices } from "../../../domains/groups/application/CampaignServices";
import type { GroupActivity } from "../../../domains/groups/application/GroupActivity";
import type { GroupMaker } from "../../../domains/groups/application/GroupMaker";
import type { GroupTicker } from "../../../domains/groups/application/GroupPorts";
import type { GroupSync } from "../../../domains/groups/application/GroupSync";
import type { PostDispatcher } from "../../../domains/groups/application/PostDispatcher";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import type { ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

// ---------------------------------------------------------------------------
// Grupos ↔ cola de tareas.
//   groups.sync      traer los grupos de WhatsApp (cada 30 min con campañas activas)
//   groups.prepare   crear el grupo siguiente de una campaña si hace falta
//   groups.welcome   la bienvenida agrupada de un grupo
//   groups.post      un grupo del envío (una cadena por envío)
//   groups.apply     llevar la plantilla de la campaña a sus grupos
// ---------------------------------------------------------------------------

export const GROUP_TASKS = { sync: "groups.sync", prepare: "groups.prepare", welcome: "groups.welcome", post: "groups.post", apply: "groups.apply" } as const;
const BUCKET_MS = 60_000;

export class SchedulerGroupTicker implements GroupTicker {
  public constructor(private readonly scheduler: TaskScheduler) {}

  public async sync(tenantId: string, at: Date): Promise<void> {
    await this.scheduler.replaceInGroup({ tenantId, kind: GROUP_TASKS.sync, groupKey: `groups-sync:${tenantId}`, dedupeKey: `${GROUP_TASKS.sync}:${tenantId}:${Math.floor(at.getTime() / BUCKET_MS)}`, payload: {}, dueAt: at, maxAttempts: 2 });
  }

  public async prepare(tenantId: string, campaignId: string, at: Date): Promise<void> {
    await this.once(tenantId, GROUP_TASKS.prepare, `group-campaign:${campaignId}`, campaignId, at, { campaignId });
  }

  public async welcome(tenantId: string, groupId: string, at: Date): Promise<void> {
    await this.once(tenantId, GROUP_TASKS.welcome, `group:${groupId}`, groupId, at, { groupId });
  }

  public async post(tenantId: string, postId: string, at: Date): Promise<void> {
    await this.scheduler.replaceInGroup({ tenantId, kind: GROUP_TASKS.post, groupKey: `group-post:${postId}`, dedupeKey: `${GROUP_TASKS.post}:${postId}:${at.getTime()}`, payload: { postId }, dueAt: at });
  }

  public async apply(tenantId: string, campaignId: string, at: Date): Promise<void> {
    await this.once(tenantId, GROUP_TASKS.apply, `group-campaign:${campaignId}`, campaignId, at, { campaignId });
  }

  public async stopPost(tenantId: string, postId: string): Promise<void> {
    await this.scheduler.cancelGroup(tenantId, `group-post:${postId}`);
  }

  /** Una por tramo de un minuto: pedirla varias veces seguidas deja una sola. */
  private async once(tenantId: string, kind: string, groupKey: string, id: string, at: Date, payload: Record<string, string>): Promise<void> {
    await this.scheduler.schedule({ tenantId, kind, groupKey, dedupeKey: `${kind}:${id}:${Math.floor(at.getTime() / BUCKET_MS)}`, payload, dueAt: at, maxAttempts: 3 });
  }
}

const field = (task: ScheduledTask, key: string) => (typeof task.payload[key] === "string" ? (task.payload[key] as string) : null);

export function groupTaskHandlers(parts: {
  readonly sync: GroupSync;
  readonly maker: GroupMaker;
  readonly activity: GroupActivity;
  readonly dispatcher: PostDispatcher;
  readonly campaigns: CampaignServices;
}): TaskHandler[] {
  const by = (kind: string, key: string, run: (tenantId: string, id: string) => Promise<unknown>): TaskHandler => ({
    kind,
    handle: async (task) => {
      const id = field(task, key);
      if (id) await run(task.tenantId, id);
    }
  });
  return [
    { kind: GROUP_TASKS.sync, handle: async (task) => void (await parts.sync.syncTenant(task.tenantId)) },
    by(GROUP_TASKS.prepare, "campaignId", (tenantId, id) => parts.maker.prepare(tenantId, id)),
    by(GROUP_TASKS.welcome, "groupId", (tenantId, id) => parts.activity.welcome(tenantId, id)),
    by(GROUP_TASKS.post, "postId", (tenantId, id) => parts.dispatcher.tick(tenantId, id)),
    by(GROUP_TASKS.apply, "campaignId", (tenantId, id) => parts.campaigns.applyTemplate(tenantId, id))
  ];
}
