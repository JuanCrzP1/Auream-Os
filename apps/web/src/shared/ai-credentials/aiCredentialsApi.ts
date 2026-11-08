import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  AiCredentialSummary,
  AiModelListResponse,
  AiModelOption,
  CreateAiCredentialRequest,
  UpdateAiCredentialRequest
} from "@contracts/AiContracts";

// Conexiones de IA de la cuenta activa. Ninguna respuesta trae la clave.

export async function fetchAiCredentials(): Promise<AiCredentialSummary[]> {
  return [...(await builderApiClient.get<{ credentials: AiCredentialSummary[] }>("/ai-credentials")).credentials];
}

export function createAiCredential(request: CreateAiCredentialRequest): Promise<AiCredentialSummary> {
  return builderApiClient.post<AiCredentialSummary>("/ai-credentials", request);
}

export function updateAiCredential(id: string, request: UpdateAiCredentialRequest): Promise<AiCredentialSummary> {
  return builderApiClient.patch<AiCredentialSummary>(`/ai-credentials/${encodeURIComponent(id)}`, request);
}

export async function deleteAiCredential(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`/ai-credentials/${encodeURIComponent(id)}`);
}

export function verifyAiCredential(id: string): Promise<AiCredentialSummary> {
  return builderApiClient.post<AiCredentialSummary>(`/ai-credentials/${encodeURIComponent(id)}/verify`);
}

export async function fetchAiModels(id: string): Promise<AiModelOption[]> {
  return [...(await builderApiClient.get<AiModelListResponse>(`/ai-credentials/${encodeURIComponent(id)}/models`)).models];
}
