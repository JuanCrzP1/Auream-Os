import type { CampaignDetailResponse, CampaignSummary, GroupsOverviewResponse } from "../../../contracts/GroupContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { groupName, requireCampaignDraft, type Campaign } from "../domain/Campaign";
import type { GroupEngine } from "./GroupEngine";
import { toCampaignSummary, toGroupSummary, type Names } from "./groupViews";
import type { PostServices } from "./PostServices";

// ---------------------------------------------------------------------------
// Las campañas de grupos: la portada (con lo de este mes), cada campaña por
// dentro, crearla (el primer grupo se crea enseguida), editarla (y llevar los
// cambios a todos sus grupos), apagar o encender el enlace.
// ---------------------------------------------------------------------------

export interface GroupActor {
  readonly tenantId: string;
  readonly canManage: boolean;
}

export class CampaignServices {
  public constructor(
    private readonly engine: GroupEngine,
    private readonly posts: Pick<PostServices, "list">
  ) {}

  public async overview(actor: GroupActor): Promise<GroupsOverviewResponse> {
    const { campaigns, groups, results, numbers } = this.engine;
    const [list, all, phones] = await Promise.all([campaigns.list(actor.tenantId), groups.list(actor.tenantId), numbers.list(actor.tenantId)]);
    const ids = list.map((campaign) => campaign.id);
    const [stats, month] = await Promise.all([results.campaigns(actor.tenantId, ids, null), results.campaigns(actor.tenantId, ids, await this.monthStart(actor.tenantId))]);
    const names = this.names(phones, list);
    const sum = (pick: (s: NonNullable<ReturnType<typeof month.get>>) => number) => [...month.values()].reduce((total, s) => total + pick(s), 0);
    return {
      campaigns: list.map((campaign) => toCampaignSummary(campaign, all, stats.get(campaign.id), names, this.engine.linkBase)),
      month: {
        clicks: sum((s) => s.clicks),
        members: all.filter((g) => g.campaignId).reduce((total, g) => total + g.members, 0),
        joined: sum((s) => s.joined),
        left: sum((s) => s.left),
        buyers: sum((s) => s.buyers),
        revenue: mergeRevenue([...month.values()].flatMap((s) => s.revenue))
      },
      canManage: actor.canManage,
      hasNumbers: phones.some((phone) => phone.connected && phone.qr)
    };
  }

  public async detail(actor: GroupActor, id: string): Promise<CampaignDetailResponse> {
    const campaign = await this.require(actor.tenantId, id);
    const { groups, results, numbers, timezoneOf } = this.engine;
    const [all, phones] = await Promise.all([groups.list(actor.tenantId, id), numbers.list(actor.tenantId)]);
    const names = this.names(phones, [campaign]);
    const [stats, perGroup, daily, posts] = await Promise.all([
      results.campaigns(actor.tenantId, [id], null),
      results.groups(actor.tenantId, all.map((g) => g.id), null),
      results.daily(actor.tenantId, id, 14, await timezoneOf(actor.tenantId)),
      this.posts.list(actor.tenantId, id)
    ]);
    return {
      campaign: toCampaignSummary(campaign, all, stats.get(id), names, this.engine.linkBase),
      groups: [...all].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((group) => toGroupSummary(group, perGroup.get(group.id), names, all)),
      posts,
      daily,
      canManage: actor.canManage
    };
  }

  public async create(actor: GroupActor, body: unknown): Promise<CampaignSummary> {
    const draft = requireCampaignDraft(body);
    await this.check(actor.tenantId, draft.slug, draft.connectionIds, null);
    const campaign: Campaign = { ...draft, id: this.engine.newId(), tenantId: actor.tenantId, status: "active", createdAt: this.engine.now().toISOString() };
    await this.engine.campaigns.create(campaign);
    // El primer grupo se crea en la cola (WhatsApp tarda unos segundos); el enlace igual funciona antes.
    await this.engine.ticker.prepare(actor.tenantId, campaign.id, this.engine.now());
    await this.engine.ticker.sync(actor.tenantId, new Date(this.engine.now().getTime() + 30 * 60_000));
    return this.summary(actor.tenantId, campaign.id);
  }

  public async update(actor: GroupActor, id: string, body: unknown): Promise<CampaignSummary> {
    const current = await this.require(actor.tenantId, id);
    const draft = requireCampaignDraft(body);
    await this.check(actor.tenantId, draft.slug, draft.connectionIds, id);
    await this.engine.campaigns.update(actor.tenantId, { ...current, ...draft });
    // Nombre, foto, descripción y reglas a todos sus grupos (en la cola, sin apuro).
    await this.engine.ticker.apply(actor.tenantId, id, this.engine.now());
    return this.summary(actor.tenantId, id);
  }

  public async setOpen(actor: GroupActor, id: string, open: boolean): Promise<CampaignSummary> {
    const campaign = await this.require(actor.tenantId, id);
    await this.engine.campaigns.update(actor.tenantId, { ...campaign, status: open ? "active" : "closed" });
    if (open) await this.engine.ticker.prepare(actor.tenantId, id, this.engine.now());
    return this.summary(actor.tenantId, id);
  }

  /** Lleva el nombre (« #n»), la descripción, la foto y las reglas de la campaña a cada grupo suyo. */
  public async applyTemplate(tenantId: string, id: string): Promise<void> {
    const campaign = await this.engine.campaigns.find(tenantId, id);
    if (!campaign) return;
    const { namePattern, description, imageUrl, announce, locked } = campaign.template;
    for (const group of await this.engine.groups.list(tenantId, id)) {
      if (!group.isAdmin || group.position === null) continue;
      const name = groupName(namePattern, group.position);
      await this.engine.gateway.configure(tenantId, group.connectionId, group.jid, { name, description, ...(imageUrl ? { imageUrl } : {}), announce, locked }).catch(() => undefined);
      await this.engine.groups.update(tenantId, group.id, { name, description, imageUrl, announce, locked });
    }
  }

  private async summary(tenantId: string, id: string): Promise<CampaignSummary> {
    const campaign = await this.require(tenantId, id);
    const [all, phones, stats] = await Promise.all([this.engine.groups.list(tenantId, id), this.engine.numbers.list(tenantId), this.engine.results.campaigns(tenantId, [id], null)]);
    return toCampaignSummary(campaign, all, stats.get(id), this.names(phones, [campaign]), this.engine.linkBase);
  }

  private async require(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.engine.campaigns.find(tenantId, id);
    if (!campaign) throw new NotFoundError("Esa campaña no existe.");
    return campaign;
  }

  private async check(tenantId: string, slug: string, connectionIds: ReadonlyArray<string>, exceptId: string | null): Promise<void> {
    if (await this.engine.campaigns.slugTaken(slug, exceptId)) throw new ValidationError(`El enlace «${slug}» ya está en uso. Elige otro.`);
    const phones = await this.engine.numbers.list(tenantId);
    for (const id of connectionIds) {
      const phone = phones.find((p) => p.id === id);
      if (!phone) throw new ValidationError("Ese número ya no existe en tu cuenta.");
      if (!phone.qr) throw new ValidationError(`«${phone.name}» es de la API oficial: los grupos van por números conectados con QR.`);
    }
  }

  private names(phones: ReadonlyArray<{ id: string; name: string }>, campaigns: ReadonlyArray<Campaign>): Names {
    return { numbers: new Map(phones.map((p) => [p.id, p.name])), campaigns: new Map(campaigns.map((c) => [c.id, c])) };
  }

  private async monthStart(tenantId: string): Promise<Date> {
    const timezone = await this.engine.timezoneOf(tenantId);
    const now = this.engine.now();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).format(now);
    const [year, month] = parts.split("-").map(Number);
    const guess = new Date(Date.UTC(year!, month! - 1, 1));
    const offset = new Date(guess.toLocaleString("en-US", { timeZone: timezone })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
    return new Date(guess.getTime() - offset);
  }
}

function mergeRevenue(amounts: ReadonlyArray<{ currency: string; amount: number }>) {
  const totals = new Map<string, number>();
  for (const { currency, amount } of amounts) totals.set(currency, (totals.get(currency) ?? 0) + amount);
  return [...totals].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
}
