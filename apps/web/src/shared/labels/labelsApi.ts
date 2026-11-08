import { builderApiClient } from "@shared/http/builderApiClient";
import type { CreateLabelRequest, LabelSummary, UpdateLabelRequest } from "@contracts/ContactContracts";

// Catálogo de etiquetas de la cuenta activa. El tenant lo resuelve el servidor.

export async function fetchLabels(): Promise<LabelSummary[]> {
  return (await builderApiClient.get<{ labels: LabelSummary[] }>("/labels")).labels;
}

export function createLabel(request: CreateLabelRequest): Promise<LabelSummary> {
  return builderApiClient.post<LabelSummary>("/labels", request);
}

export function updateLabel(id: string, request: UpdateLabelRequest): Promise<LabelSummary> {
  return builderApiClient.patch<LabelSummary>(`/labels/${encodeURIComponent(id)}`, request);
}

export async function deleteLabel(id: string): Promise<void> {
  await builderApiClient.delete<unknown>(`/labels/${encodeURIComponent(id)}`);
}
