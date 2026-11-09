import { builderApiClient } from "@shared/http/builderApiClient";
import type {
  ConnectionLinkState,
  ConnectionSummary,
  CreateConnectionRequest,
  UpdateConnectionRequest
} from "@contracts/ConnectionContracts";

// Números de WhatsApp de la cuenta activa.

export async function fetchConnections(): Promise<ConnectionSummary[]> {
  return [...(await builderApiClient.get<{ connections: ConnectionSummary[] }>("/connections")).connections];
}

export function createConnection(request: CreateConnectionRequest): Promise<ConnectionSummary> {
  return builderApiClient.post<ConnectionSummary>("/connections", request);
}

export function renameConnection(id: string, request: UpdateConnectionRequest): Promise<ConnectionSummary> {
  return builderApiClient.patch<ConnectionSummary>(`/connections/${encodeURIComponent(id)}`, request);
}

export async function deleteConnection(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`/connections/${encodeURIComponent(id)}`);
}

export function linkConnection(id: string): Promise<ConnectionLinkState> {
  return builderApiClient.post<ConnectionLinkState>(`/connections/${encodeURIComponent(id)}/link`);
}
