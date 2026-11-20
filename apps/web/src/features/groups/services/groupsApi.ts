import type {
  CampaignDetailResponse,
  CampaignSummary,
  CreateGroupPostRequest,
  GroupListResponse,
  GroupPostSummary,
  GroupsOverviewResponse,
  SaveCampaignRequest
} from "@contracts/GroupContracts";
import type { GroupMemberFilter, GroupMembersPage, LabelGroupMembersResponse } from "@contracts/GroupMemberContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// Grupos y comunidades de la cuenta activa (`/groups`).

const id = (value: string) => encodeURIComponent(value);

export const groupsApi = {
  overview: () => builderApiClient.get<GroupsOverviewResponse>("/groups"),
  list: () => builderApiClient.get<GroupListResponse>("/groups/list"),
  sync: () => builderApiClient.post<GroupListResponse & { readonly failed: ReadonlyArray<string> }>("/groups/sync"),
  attach: (groupId: string, campaignId: string | null) => builderApiClient.patch<GroupListResponse>(`/groups/list/${id(groupId)}`, { campaignId }),
  campaign: (campaignId: string) => builderApiClient.get<CampaignDetailResponse>(`/groups/campaigns/${id(campaignId)}`),
  create: (request: SaveCampaignRequest) => builderApiClient.post<CampaignSummary>("/groups/campaigns", request),
  update: (campaignId: string, request: SaveCampaignRequest) => builderApiClient.put<CampaignSummary>(`/groups/campaigns/${id(campaignId)}`, request),
  setOpen: (campaignId: string, open: boolean) => builderApiClient.post<CampaignSummary>(`/groups/campaigns/${id(campaignId)}/${open ? "open" : "close"}`),
  send: (request: CreateGroupPostRequest) => builderApiClient.post<GroupPostSummary>("/groups/posts", request),
  cancelPost: (postId: string) => builderApiClient.post<{ posts: GroupPostSummary[] }>(`/groups/posts/${id(postId)}/cancel`),
  /** Los miembros de un grupo: un filtro, una búsqueda y desde dónde seguir. */
  members: (groupId: string, filter: GroupMemberFilter, search: string, offset = 0) => {
    const params = new URLSearchParams({ filter, ...(search.trim() ? { search: search.trim() } : {}), ...(offset > 0 ? { offset: String(offset) } : {}) });
    return builderApiClient.get<GroupMembersPage>(`/groups/list/${id(groupId)}/members?${params.toString()}`);
  },
  /** Una tanda de la etiqueta: dice cuántos faltan. */
  labelMembers: (groupId: string, filter: GroupMemberFilter, label: string) =>
    builderApiClient.post<LabelGroupMembersResponse>(`/groups/list/${id(groupId)}/members/label`, { filter, label }),
  /** El CSV de los miembros de un filtro (queda registrado quién lo descargó). */
  exportMembers: async (groupId: string, filter: GroupMemberFilter) => {
    const file = await builderApiClient.download(`/groups/list/${id(groupId)}/members/export?filter=${filter}`);
    return {
      blob: file.blob,
      filename: file.filename ?? "miembros.csv",
      rows: Number(file.headers.get("X-Export-Rows") ?? 0),
      truncated: file.headers.get("X-Export-Truncated") === "true"
    };
  }
};
