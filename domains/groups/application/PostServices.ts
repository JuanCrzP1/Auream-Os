import type { GroupPostSummary } from "../../../contracts/GroupContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { requirePost } from "../domain/GroupPost";
import type { GroupActor } from "./CampaignServices";
import type { GroupEngine } from "./GroupEngine";
import type { GroupPost } from "./GroupPorts";

// ---------------------------------------------------------------------------
// Mensajes a muchos grupos: elegir campañas y grupos sueltos, ahora o
// programado. Sale grupo por grupo con una pausa al azar (`PostDispatcher`),
// cada uno por el número que lo administra.
// ---------------------------------------------------------------------------

export class PostServices {
  public constructor(private readonly engine: GroupEngine) {}

  public async create(actor: GroupActor, body: unknown): Promise<GroupPostSummary> {
    const { groups, campaigns, posts, ticker, now, newId } = this.engine;
    const draft = requirePost(body, now());
    const all = await groups.list(actor.tenantId);
    const list = await campaigns.list(actor.tenantId);
    const chosen = all.filter((group) => group.isAdmin && (draft.groupIds.includes(group.id) || (group.campaignId !== null && draft.campaignIds.includes(group.campaignId))));
    if (chosen.length === 0) throw new ValidationError("Ninguno de esos grupos está administrado por tus números.");
    const names = [...draft.campaignIds.map((id) => list.find((c) => c.id === id)?.name).filter(Boolean), ...all.filter((g) => draft.groupIds.includes(g.id)).map((g) => g.name)];
    const post: GroupPost = {
      id: newId(),
      tenantId: actor.tenantId,
      content: draft.content,
      mentionAll: draft.mentionAll,
      status: "scheduled",
      target: names.slice(0, 3).join(", ") + (names.length > 3 ? ` y ${names.length - 3} más` : ""),
      campaignIds: draft.campaignIds,
      scheduledAt: draft.scheduledAt,
      finishedAt: null,
      createdAt: now().toISOString()
    };
    await posts.create(post, chosen.map((group) => group.id));
    await ticker.post(actor.tenantId, post.id, draft.scheduledAt ? new Date(draft.scheduledAt) : now());
    return (await this.list(actor.tenantId, null)).find((item) => item.id === post.id)!;
  }

  public async list(tenantId: string, campaignId: string | null): Promise<GroupPostSummary[]> {
    const rows = await this.engine.posts.list(tenantId, campaignId, 30);
    return rows.map((row) => ({
      id: row.id, content: row.content, mentionAll: row.mentionAll, status: row.status, target: row.target, groups: row.groups, sent: row.sent, failed: row.failed,
      scheduledAt: row.scheduledAt, finishedAt: row.finishedAt, createdAt: row.createdAt
    }));
  }

  public async cancel(actor: GroupActor, id: string): Promise<GroupPostSummary[]> {
    const post = await this.engine.posts.find(actor.tenantId, id);
    if (!post) throw new NotFoundError("Ese envío no existe.");
    if (!(await this.engine.posts.transition(actor.tenantId, id, ["scheduled", "sending"], "cancelled", this.engine.now()))) throw new ValidationError("Ese envío ya terminó.");
    await this.engine.ticker.stopPost(actor.tenantId, id);
    await this.engine.posts.cancelPending(actor.tenantId, id);
    return this.list(actor.tenantId, null);
  }
}
