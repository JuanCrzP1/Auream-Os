import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  BoardFilters,
  BoardResponse,
  ImportClientsResponse,
  MoveDealRequest,
  PipelineListResponse,
  PipelineSummary,
  SavePipelineRequest,
  StageCardsResponse,
  UpdateDealRequest
} from "@contracts/CrmContracts";
import type {
  ContactCrmResponse,
  ContactDeal,
  FollowUpBucket,
  FollowUpListResponse,
  FollowUpSummary,
  SaveFollowUpRequest,
  UpdateFollowUpRequest
} from "@contracts/CrmActivityContracts";

// El CRM de la cuenta activa (`/crm`). La cuenta la elige el servidor.

const id = (value: string) => encodeURIComponent(value);

function query(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const crmApi = {
  pipelines: () => builderApiClient.get<PipelineListResponse>("/crm/pipelines"),
  createStarter: () => builderApiClient.post<PipelineSummary>("/crm/pipelines/starter"),
  createPipeline: (request: SavePipelineRequest) => builderApiClient.post<PipelineSummary>("/crm/pipelines", request),
  updatePipeline: (pipelineId: string, request: SavePipelineRequest) => builderApiClient.patch<PipelineSummary>(`/crm/pipelines/${id(pipelineId)}`, request),
  removePipeline: (pipelineId: string) => builderApiClient.delete(`/crm/pipelines/${id(pipelineId)}`),
  /** Cuántos clientes con chat entrarían (los de los últimos `days` días; `null`: todos). */
  importPreview: (pipelineId: string, days: number | null) =>
    builderApiClient.get<ImportClientsResponse>(`/crm/pipelines/${id(pipelineId)}/import${query({ days: days ?? undefined })}`),
  importClients: (pipelineId: string, days: number | null) => builderApiClient.post<ImportClientsResponse>(`/crm/pipelines/${id(pipelineId)}/import`, { days }),

  board: (pipelineId: string, filters: BoardFilters) => builderApiClient.get<BoardResponse>(`/crm/pipelines/${id(pipelineId)}/board${query({ ...filters })}`),
  stageCards: (pipelineId: string, stageId: string, filters: BoardFilters, offset: number) =>
    builderApiClient.get<StageCardsResponse>(`/crm/pipelines/${id(pipelineId)}/stages/${id(stageId)}/cards${query({ ...filters, offset })}`),
  move: (pipelineId: string, contactId: string, request: MoveDealRequest) => builderApiClient.put<void>(`/crm/pipelines/${id(pipelineId)}/deals/${id(contactId)}/stage`, request),
  updateDeal: (pipelineId: string, contactId: string, request: UpdateDealRequest) => builderApiClient.patch<ContactDeal>(`/crm/pipelines/${id(pipelineId)}/deals/${id(contactId)}`, request),
  removeDeal: (pipelineId: string, contactId: string) => builderApiClient.delete(`/crm/pipelines/${id(pipelineId)}/deals/${id(contactId)}`),

  contact: (contactId: string) => builderApiClient.get<ContactCrmResponse>(`/crm/contacts/${id(contactId)}`),

  followUps: (bucket: FollowUpBucket, assignee: "me" | "all") => builderApiClient.get<FollowUpListResponse>(`/crm/follow-ups${query({ bucket, assignee: assignee === "all" ? "all" : undefined })}`),
  createFollowUp: (request: SaveFollowUpRequest) => builderApiClient.post<FollowUpSummary>("/crm/follow-ups", request),
  updateFollowUp: (followUpId: string, request: UpdateFollowUpRequest) => builderApiClient.patch<FollowUpSummary>(`/crm/follow-ups/${id(followUpId)}`, request),
  removeFollowUp: (followUpId: string) => builderApiClient.delete(`/crm/follow-ups/${id(followUpId)}`)
};
