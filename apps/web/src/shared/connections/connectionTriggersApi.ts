import { builderApiClient } from "@shared/http/builderApiClient";
import type { ConnectionTrigger, SaveConnectionTriggerRequest } from "@contracts/ConnectionTriggerContracts";

// Disparadores de un número de WhatsApp: qué flujo arranca con cada mensaje.

const base = (connectionId: string) => `/connections/${encodeURIComponent(connectionId)}/triggers`;

export async function fetchTriggers(connectionId: string): Promise<ConnectionTrigger[]> {
  return [...(await builderApiClient.get<{ triggers: ConnectionTrigger[] }>(base(connectionId))).triggers];
}

export function createTrigger(connectionId: string, request: SaveConnectionTriggerRequest): Promise<ConnectionTrigger> {
  return builderApiClient.post<ConnectionTrigger>(base(connectionId), request);
}

export function updateTrigger(connectionId: string, id: string, request: Partial<SaveConnectionTriggerRequest>): Promise<ConnectionTrigger> {
  return builderApiClient.patch<ConnectionTrigger>(`${base(connectionId)}/${encodeURIComponent(id)}`, request);
}

export async function deleteTrigger(connectionId: string, id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`${base(connectionId)}/${encodeURIComponent(id)}`);
}
