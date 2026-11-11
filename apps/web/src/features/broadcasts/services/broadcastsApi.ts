import type { AudienceFilter, BroadcastContent, CreateBroadcastRequest } from "@contracts/BroadcastContracts";
import type {
  AudiencePreview,
  BroadcastDetailResponse,
  BroadcastListResponse,
  BroadcastSummary,
  RecipientFilter,
  RecipientsPage,
  SavedAudience
} from "@contracts/BroadcastResultsContracts";
import type { PipelineListResponse } from "@contracts/CrmContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// Difusiones de la cuenta activa (`/broadcasts`) y las etapas del CRM para
// elegir a quién (`/crm/pipelines`: cada etapa es una etiqueta).

const id = (value: string) => encodeURIComponent(value);

export interface TestOutcome {
  readonly ok: boolean;
  readonly error: string | null;
}

export const broadcastsApi = {
  list: () => builderApiClient.get<BroadcastListResponse>("/broadcasts"),
  detail: (broadcastId: string) => builderApiClient.get<BroadcastDetailResponse>(`/broadcasts/${id(broadcastId)}`),
  recipients: (broadcastId: string, filter: RecipientFilter, offset = 0) =>
    builderApiClient.get<RecipientsPage>(`/broadcasts/${id(broadcastId)}/recipients?filter=${filter}&offset=${offset}`),
  create: (request: CreateBroadcastRequest) => builderApiClient.post<BroadcastSummary>("/broadcasts", request),
  act: (broadcastId: string, action: "pause" | "resume" | "cancel") => builderApiClient.post<BroadcastSummary>(`/broadcasts/${id(broadcastId)}/${action}`),
  test: (content: BroadcastContent, connectionId: string, phone: string, optOutFooter: boolean) =>
    builderApiClient.post<TestOutcome>("/broadcasts/test", { content, connectionId, phone, optOutFooter }),
  preview: (audience: AudienceFilter, connectionIds: ReadonlyArray<string>, dailyCap: number) =>
    builderApiClient.post<AudiencePreview>("/broadcasts/audience/preview", { audience, connectionIds, dailyCap }),
  audiences: async () => (await builderApiClient.get<{ audiences: SavedAudience[] }>("/broadcasts/audiences")).audiences,
  saveAudience: (name: string, audience: AudienceFilter) => builderApiClient.post<SavedAudience>("/broadcasts/audiences", { name, audience }),
  removeAudience: (audienceId: string) => builderApiClient.delete(`/broadcasts/audiences/${id(audienceId)}`),
  pipelines: () => builderApiClient.get<PipelineListResponse>("/crm/pipelines")
};
