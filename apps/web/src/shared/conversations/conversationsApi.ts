import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  ConversationFilter,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationSummary
} from "@contracts/ConversationContracts";

// La bandeja de Conversaciones de la cuenta activa.

const one = (id: string) => `/conversations/${encodeURIComponent(id)}`;

export async function fetchConversations(query: { readonly filter: ConversationFilter; readonly search?: string; readonly connectionId?: string }): Promise<ConversationSummary[]> {
  const params = new URLSearchParams({ filter: query.filter });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.connectionId) params.set("connectionId", query.connectionId);
  return [...(await builderApiClient.get<ConversationListResponse>(`/conversations?${params.toString()}`)).conversations];
}

export function fetchConversation(id: string): Promise<ConversationSummary> {
  return builderApiClient.get<ConversationSummary>(one(id));
}

export function fetchMessages(id: string, before?: string): Promise<ConversationMessagesResponse> {
  return builderApiClient.get<ConversationMessagesResponse>(`${one(id)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`);
}

export async function markConversationRead(id: string): Promise<void> {
  await builderApiClient.post<unknown>(`${one(id)}/read`);
}

export function setConversationBot(id: string, botEnabled: boolean): Promise<ConversationSummary> {
  return builderApiClient.patch<ConversationSummary>(one(id), { botEnabled });
}

export function sendAgentMessage(id: string, text: string): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>(`${one(id)}/messages`, { text });
}

export function startFlow(id: string, automationId: string): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
  return builderApiClient.post(`${one(id)}/flows`, { automationId });
}
