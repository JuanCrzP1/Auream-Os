import type { GroupListResponse } from "../../../contracts/GroupContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { nextPosition } from "../domain/Rotation";
import type { GroupActor } from "./CampaignServices";
import type { GroupEngine } from "./GroupEngine";
import { rotating } from "./GroupMaker";
import type { GroupSync } from "./GroupSync";
import { toGroupSummary } from "./groupViews";

// ---------------------------------------------------------------------------
// «Mis grupos»: los grupos de los números conectados, traerlos de WhatsApp y
// sumar uno que ya existía a una campaña (o sacarlo).
// ---------------------------------------------------------------------------

export class GroupServices {
  public constructor(
    private readonly engine: GroupEngine,
    private readonly sync: Pick<GroupSync, "syncTenant">
  ) {}

  public async list(actor: GroupActor): Promise<GroupListResponse> {
    const { groups, campaigns, numbers, results } = this.engine;
    const [all, list, phones, syncedAt] = await Promise.all([groups.list(actor.tenantId), campaigns.list(actor.tenantId), numbers.list(actor.tenantId), groups.lastSyncedAt(actor.tenantId)]);
    const perGroup = await results.groups(actor.tenantId, all.map((g) => g.id), null);
    const names = { numbers: new Map(phones.map((p) => [p.id, p.name])), campaigns: new Map(list.map((c) => [c.id, c])) };
    const views = all.map((group) => toGroupSummary(group, perGroup.get(group.id), names, all)).sort((a, b) => b.members - a.members);
    return { groups: views, syncedAt, canManage: actor.canManage };
  }

  public async syncNow(actor: GroupActor): Promise<GroupListResponse & { readonly failed: ReadonlyArray<string> }> {
    const { failed } = await this.sync.syncTenant(actor.tenantId);
    return { ...(await this.list(actor)), failed };
  }

  /** Suma un grupo existente a una campaña (al final de la fila), o lo saca (`null`). */
  public async attach(actor: GroupActor, groupId: string, campaignId: string | null): Promise<GroupListResponse> {
    const { groups, campaigns } = this.engine;
    const group = await groups.find(actor.tenantId, groupId);
    if (!group) throw new NotFoundError("Ese grupo no existe.");
    if (campaignId === null) {
      await groups.update(actor.tenantId, groupId, { campaignId: null, position: null });
      return this.list(actor);
    }
    if (!group.isAdmin) throw new ValidationError("Tu número no es administrador de ese grupo: no se puede sumar a una campaña.");
    const campaign = await campaigns.find(actor.tenantId, campaignId);
    if (!campaign) throw new NotFoundError("Esa campaña no existe.");
    const siblings = await groups.list(actor.tenantId, campaignId);
    const inviteLink = group.inviteLink ?? (await this.engine.gateway.inviteLink(actor.tenantId, group.connectionId, group.jid).catch(() => null));
    await groups.update(actor.tenantId, groupId, { campaignId, position: nextPosition(siblings.map(rotating)), inviteLink });
    return this.list(actor);
  }
}
