import type { ScheduleMessageRequest, ScheduledMessagesResponse, UpdateScheduledMessageRequest } from "@contracts/ScheduledMessageContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// Mensajes programados de un chat (`/conversations/:id/scheduled`). Cada uno responde con los abiertos del chat.

const base = (conversationId: string) => `/conversations/${encodeURIComponent(conversationId)}/scheduled`;
const item = (conversationId: string, id: string) => `${base(conversationId)}/${encodeURIComponent(id)}`;

export const scheduledApi = {
  list: (conversationId: string) => builderApiClient.get<ScheduledMessagesResponse>(base(conversationId)),
  schedule: (conversationId: string, request: ScheduleMessageRequest) => builderApiClient.post<ScheduledMessagesResponse>(base(conversationId), request),
  update: (conversationId: string, id: string, request: UpdateScheduledMessageRequest) =>
    builderApiClient.patch<ScheduledMessagesResponse>(item(conversationId, id), request),
  sendNow: (conversationId: string, id: string) => builderApiClient.post<ScheduledMessagesResponse>(`${item(conversationId, id)}/send`, {}),
  cancel: (conversationId: string, id: string) => builderApiClient.delete<ScheduledMessagesResponse>(item(conversationId, id))
};
