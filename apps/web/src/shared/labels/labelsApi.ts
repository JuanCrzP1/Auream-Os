import { builderApiClient } from "@shared/http/builderApiClient";
import type { CreateLabelRequest, LabelSummary, UpdateLabelRequest } from "@contracts/ContactContracts";
import type { LabelsOverviewResponse, MergeLabelsRequest, MergeLabelsResponse } from "@contracts/LabelManagementContracts";

// Catálogo de etiquetas de la cuenta activa. El tenant lo resuelve el servidor.

const one = (id: string) => `/labels/${encodeURIComponent(id)}`;

export async function fetchLabels(): Promise<LabelSummary[]> {
  return (await builderApiClient.get<{ labels: LabelSummary[] }>("/labels")).labels;
}

export function createLabel(request: CreateLabelRequest): Promise<LabelSummary> {
  return builderApiClient.post<LabelSummary>("/labels", request);
}

/** Cambiar el nombre también lo cambia en los flujos y webhooks que la nombran; `flowsSkipped`: los que no se pudieron tocar. */
export function updateLabel(id: string, request: UpdateLabelRequest): Promise<LabelSummary & { readonly flowsSkipped?: ReadonlyArray<string> }> {
  return builderApiClient.patch<LabelSummary & { readonly flowsSkipped?: ReadonlyArray<string> }>(one(id), request);
}

/** Sin `into`, solo si nadie la usa. Con `into`, sus clientes y sus usos pasan a esa y después se borra. */
export async function deleteLabel(id: string, into?: string): Promise<MergeLabelsResponse | null> {
  const result = await builderApiClient.delete<MergeLabelsResponse | { deleted: true }>(into ? `${one(id)}?into=${encodeURIComponent(into)}` : one(id));
  return result && "merge" in result ? result : null;
}

// --- Configuración › Etiquetas ---------------------------------------------

/** Cada etiqueta con sus clientes, lo que vendieron, quién la usa, las repetidas y las uniones en curso. */
export function fetchLabelsOverview(): Promise<LabelsOverviewResponse> {
  return builderApiClient.get<LabelsOverviewResponse>("/labels/overview");
}

export function mergeLabels(request: MergeLabelsRequest): Promise<MergeLabelsResponse> {
  return builderApiClient.post<MergeLabelsResponse>("/labels/merge", request);
}
