import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  ConversationListQuery,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationSummary
} from "@contracts/ConversationContracts";

// La bandeja de Conversaciones de la cuenta activa.

const one = (id: string) => `/conversations/${encodeURIComponent(id)}`;

/** Una página de la bandeja con sus filtros (`cursor` = `nextCursor` de la anterior). */
export function fetchConversations(query: ConversationListQuery): Promise<ConversationListResponse> {
  const params = new URLSearchParams({ filter: query.filter ?? "all" });
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.connectionId) params.set("connectionId", query.connectionId);
  if (query.labelIds?.length) params.set("labelIds", query.labelIds.join(","));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.cursor) params.set("cursor", query.cursor);
  return builderApiClient.get<ConversationListResponse>(`/conversations?${params.toString()}`);
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

/** Etiquetas del chat (las de su cliente en Contactos). */
export function setConversationLabels(id: string, labelIds: ReadonlyArray<string>): Promise<ConversationSummary> {
  return builderApiClient.put<ConversationSummary>(`${one(id)}/labels`, { labelIds });
}

export function startFlow(id: string, automationId: string): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
  return builderApiClient.post(`${one(id)}/flows`, { automationId });
}
