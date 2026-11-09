import { builderApiClient } from "@shared/http/builderApiClient";
import type { CreateWebhookRequest, UpdateWebhookRequest, WebhookDelivery, WebhookDetail, WebhookSummary } from "@contracts/WebhookContracts";

// Webhooks de entrada de la cuenta activa (`/inbound-webhooks`).

const one = (id: string) => `/inbound-webhooks/${encodeURIComponent(id)}`;

export async function fetchWebhooks(): Promise<WebhookSummary[]> {
  return [...(await builderApiClient.get<{ webhooks: WebhookSummary[] }>("/inbound-webhooks")).webhooks];
}

export function fetchWebhook(id: string): Promise<WebhookDetail> {
  return builderApiClient.get<WebhookDetail>(one(id));
}

export function createWebhook(request: CreateWebhookRequest): Promise<WebhookDetail> {
  return builderApiClient.post<WebhookDetail>("/inbound-webhooks", request);
}

export function updateWebhook(id: string, request: UpdateWebhookRequest): Promise<WebhookDetail> {
  return builderApiClient.patch<WebhookDetail>(one(id), request);
}

export async function deleteWebhook(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(one(id));
}

export async function fetchWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  return [...(await builderApiClient.get<{ deliveries: WebhookDelivery[] }>(`${one(id)}/deliveries`)).deliveries];
}
