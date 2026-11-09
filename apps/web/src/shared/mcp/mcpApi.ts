import { builderApiClient } from "@shared/http/builderApiClient";
import type { CreateMcpCredentialRequest, McpCredentialCreated, McpCredentialSummary, McpServerInfo } from "@contracts/McpContracts";

// Agentes de IA (MCP) de la cuenta activa (`/mcp-credentials`). Ninguna lista trae el token.

export async function fetchMcpCredentials(): Promise<{ readonly server: McpServerInfo; readonly credentials: McpCredentialSummary[] }> {
  const response = await builderApiClient.get<{ server: McpServerInfo; credentials: McpCredentialSummary[] }>("/mcp-credentials");
  return { server: response.server, credentials: [...response.credentials] };
}

export function createMcpCredential(request: CreateMcpCredentialRequest): Promise<McpCredentialCreated> {
  return builderApiClient.post<McpCredentialCreated>("/mcp-credentials", request);
}

export async function revokeMcpCredential(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`/mcp-credentials/${encodeURIComponent(id)}`);
}
