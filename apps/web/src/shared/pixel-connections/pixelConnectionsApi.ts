import { builderApiClient } from "@shared/http/builderApiClient";
import type { CreatePixelConnectionRequest, PixelConnectionSummary, UpdatePixelConnectionRequest } from "@contracts/PixelContracts";

// Píxeles de Meta de la cuenta activa. Ninguna respuesta trae el token.

export async function fetchPixelConnections(): Promise<PixelConnectionSummary[]> {
  return [...(await builderApiClient.get<{ connections: PixelConnectionSummary[] }>("/pixel-connections")).connections];
}

export function createPixelConnection(request: CreatePixelConnectionRequest): Promise<PixelConnectionSummary> {
  return builderApiClient.post<PixelConnectionSummary>("/pixel-connections", request);
}

export function updatePixelConnection(id: string, request: UpdatePixelConnectionRequest): Promise<PixelConnectionSummary> {
  return builderApiClient.patch<PixelConnectionSummary>(`/pixel-connections/${encodeURIComponent(id)}`, request);
}

export async function deletePixelConnection(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`/pixel-connections/${encodeURIComponent(id)}`);
}

export function verifyPixelConnection(id: string): Promise<PixelConnectionSummary> {
  return builderApiClient.post<PixelConnectionSummary>(`/pixel-connections/${encodeURIComponent(id)}/verify`);
}
