import { builderApiClient } from "@shared/http/builderApiClient";
import type { QuickReply, QuickReplyListResponse, SaveQuickReplyRequest } from "@contracts/QuickReplyContracts";

// Respuestas rápidas de la cuenta activa (`/quick-replies`).

const one = (id: string) => `/quick-replies/${encodeURIComponent(id)}`;

export function fetchQuickReplies(): Promise<QuickReplyListResponse> {
  return builderApiClient.get<QuickReplyListResponse>("/quick-replies");
}

export function createQuickReply(request: SaveQuickReplyRequest): Promise<QuickReply> {
  return builderApiClient.post<QuickReply>("/quick-replies", request);
}

export function updateQuickReply(id: string, request: SaveQuickReplyRequest): Promise<QuickReply> {
  return builderApiClient.put<QuickReply>(one(id), request);
}

export async function deleteQuickReply(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(one(id));
}

/** Se usó en un chat (las más usadas suben). Si falla, no importa. */
export function markQuickReplyUsed(id: string): void {
  void builderApiClient.post<unknown>(`${one(id)}/use`).catch(() => undefined);
}
