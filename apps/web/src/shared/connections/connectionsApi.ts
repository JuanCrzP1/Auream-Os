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

/** Vincular o reconectar. `restart`: descartar el código actual y pedir uno nuevo. */
export function linkConnection(id: string, restart = false): Promise<ConnectionLinkState> {
  return builderApiClient.post<ConnectionLinkState>(`/connections/${encodeURIComponent(id)}/link`, restart ? { restart: true } : {});
}

/** Cómo va la vinculación: QR renovado, conectada o sesión cerrada. */
export function checkConnection(id: string): Promise<ConnectionLinkState> {
  return builderApiClient.get<ConnectionLinkState>(`/connections/${encodeURIComponent(id)}/status`);
}

/** Cierra la sesión de WhatsApp del número; la conexión queda (se reconecta con un QR nuevo). */
export function disconnectConnection(id: string): Promise<ConnectionSummary> {
  return builderApiClient.post<ConnectionSummary>(`/connections/${encodeURIComponent(id)}/disconnect`, {});
}

/** Retoma la conexión de un número vinculado sin desvincularlo. */
export function restartConnection(id: string): Promise<ConnectionSummary> {
  return builderApiClient.post<ConnectionSummary>(`/connections/${encodeURIComponent(id)}/restart`, {});
}

/** ¿Siguen vivos los números conectados? (el servidor lo limita a una revisión por minuto). */
export function verifyConnections(): Promise<{ readonly verified: boolean; readonly changed: number }> {
  return builderApiClient.post<{ verified: boolean; changed: number }>("/connections/verify", {});
}
