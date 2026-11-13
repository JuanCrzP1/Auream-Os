import type { CampaignStats, CampaignSummary, GroupNumbers, GroupSummary } from "../../../contracts/GroupContracts";
import type { Campaign } from "../domain/Campaign";
import { currentGroup, stateOf } from "../domain/Rotation";
import { rotating } from "./GroupMaker";
import type { WaGroup } from "./GroupPorts";

// De lo guardado a lo que ve la pantalla.

export const EMPTY_NUMBERS: GroupNumbers = { members: 0, joined: 0, left: 0, buyers: 0, revenue: [] };
export const EMPTY_STATS: CampaignStats = { ...EMPTY_NUMBERS, clicks: 0 };

export interface Names {
  readonly numbers: ReadonlyMap<string, string>;
  readonly campaigns: ReadonlyMap<string, Campaign>;
}

export function toGroupSummary(group: WaGroup, numbers: GroupNumbers | undefined, names: Names, siblings: ReadonlyArray<WaGroup>): GroupSummary {
  const campaign = group.campaignId ? names.campaigns.get(group.campaignId) ?? null : null;
  const current = campaign ? currentGroup(siblings.filter((g) => g.campaignId === campaign.id).map(rotating), campaign.capacity) : null;
  return {
    ...(numbers ?? EMPTY_NUMBERS),
    members: group.members,
    id: group.id,
    connectionId: group.connectionId,
    connectionName: names.numbers.get(group.connectionId) ?? "Número eliminado",
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    campaignId: campaign?.id ?? null,
    campaignName: campaign?.name ?? null,
    position: group.position,
    state: campaign ? stateOf(rotating(group), current, campaign.capacity) : "other",
    isAdmin: group.isAdmin,
    announce: group.announce,
    locked: group.locked,
    inviteLink: group.isAdmin ? group.inviteLink : null,
    syncedAt: group.syncedAt
  };
}

export function toCampaignSummary(campaign: Campaign, groups: ReadonlyArray<WaGroup>, stats: CampaignStats | undefined, names: Names, linkBase: string): CampaignSummary {
  const mine = groups.filter((group) => group.campaignId === campaign.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const current = currentGroup(mine.map(rotating), campaign.capacity);
  const currentGroupRow = current ? mine.find((group) => group.id === current.id) ?? null : null;
  return {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    link: `${linkBase}/${campaign.slug}`,
    status: campaign.status,
    connections: campaign.connectionIds.map((id) => ({ id, name: names.numbers.get(id) ?? "Número eliminado" })),
    capacity: campaign.capacity,
    template: campaign.template,
    rules: campaign.rules,
    groups: mine.map((group) => ({ id: group.id, name: group.name, members: group.members, position: group.position, state: stateOf(rotating(group), current, campaign.capacity) })),
    current: currentGroupRow ? { groupId: currentGroupRow.id, name: currentGroupRow.name, free: Math.max(0, campaign.capacity - currentGroupRow.members) } : null,
    stats: stats ?? { ...EMPTY_STATS, members: mine.reduce((total, group) => total + group.members, 0) },
    createdAt: campaign.createdAt
  };
}
