import type {
  CampaignDetailResponse,
  CampaignSummary,
  CreateGroupPostRequest,
  GroupListResponse,
  GroupPostSummary,
  GroupsOverviewResponse,
  SaveCampaignRequest
} from "@contracts/GroupContracts";
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
  cancelPost: (postId: string) => builderApiClient.post<{ posts: GroupPostSummary[] }>(`/groups/posts/${id(postId)}/cancel`)
};
