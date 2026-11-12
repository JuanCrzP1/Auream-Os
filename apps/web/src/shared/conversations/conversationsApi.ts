import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  ChatAgentsResponse,
  ConversationListQuery,
  ConversationListResponse,
  ConversationLiveResponse,
  ConversationMessagesResponse,
  ConversationSummary,
  SendAgentMessageRequest,
  StartConversationRequest
} from "@contracts/ConversationContracts";

// La bandeja de Conversaciones de la cuenta activa.

const one = (id: string) => `/conversations/${encodeURIComponent(id)}`;

/** Una página de la bandeja con sus filtros (`cursor` = `nextCursor` de la anterior). */
export function fetchConversations(query: ConversationListQuery): Promise<ConversationListResponse> {
  const params = new URLSearchParams({ filter: query.filter ?? "all" });
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
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

/**
 * Un chat en vivo: sin `since`, el chat y su última página; con `since` (el
 * `cursor` anterior, tal cual), solo lo nuevo o cambiado (entregado, leído…).
 */
export function fetchLive(id: string, since?: string): Promise<ConversationLiveResponse> {
  return builderApiClient.get<ConversationLiveResponse>(`${one(id)}/live${since ? `?since=${encodeURIComponent(since)}` : ""}`);
}

export async function markConversationRead(id: string): Promise<void> {
  await builderApiClient.post<unknown>(`${one(id)}/read`);
}

export function setConversationBot(id: string, botEnabled: boolean): Promise<ConversationSummary> {
  return builderApiClient.patch<ConversationSummary>(one(id), { botEnabled });
}

/** Responder como asesor: un texto o varias piezas en orden (archivos, notas de voz), citando un mensaje si se quiere. */
export function sendAgentMessage(id: string, request: SendAgentMessageRequest): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>(`${one(id)}/messages`, request);
}

/** Reaccionar a un mensaje con un emoji (vacío la quita). */
export async function reactToMessage(id: string, messageId: string, emoji: string): Promise<void> {
  await builderApiClient.post<unknown>(`${one(id)}/messages/${encodeURIComponent(messageId)}/reaction`, { emoji });
}

/** Eliminar el chat con su historial (el cliente sigue en Contactos). */
export async function deleteConversation(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(one(id));
}

/** Etiquetas del chat (las de su cliente en Contactos). */
export function setConversationLabels(id: string, labelIds: ReadonlyArray<string>): Promise<ConversationSummary> {
  return builderApiClient.put<ConversationSummary>(`${one(id)}/labels`, { labelIds });
}

export function startFlow(id: string, automationId: string): Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }> {
  return builderApiClient.post(`${one(id)}/flows`, { automationId });
}

/** Quién puede atender chats y quién mira. */
export function fetchChatAgents(): Promise<ChatAgentsResponse> {
  return builderApiClient.get<ChatAgentsResponse>("/conversations/agents");
}

/** «Tomar chat»: queda a nombre de quien mira y el bot se pausa. */
export function takeConversation(id: string): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>(`${one(id)}/take`);
}

/** Pasar el chat a un asesor (`null`: sin asignar, en espera). */
export function assignConversation(id: string, assigneeId: string | null): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>(`${one(id)}/assign`, { assigneeId });
}

/** «Resolver»: se cierra y el bot vuelve a atender. */
export function resolveConversation(id: string): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>(`${one(id)}/resolve`);
}

/** «Chat nuevo»: escribirle primero a un número (o abrir su chat si ya existe). */
export function startConversation(request: StartConversationRequest): Promise<ConversationSummary> {
  return builderApiClient.post<ConversationSummary>("/conversations", request);
}
