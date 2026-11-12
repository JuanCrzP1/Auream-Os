import type { ChatAdResponse } from "@contracts/ChatAdContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

/** El anuncio por el que llegó el cliente de un chat (`GET /conversations/:id/ad`). */
export function fetchChatAd(conversationId: string): Promise<ChatAdResponse> {
  return builderApiClient.get<ChatAdResponse>(`/conversations/${encodeURIComponent(conversationId)}/ad`);
}
