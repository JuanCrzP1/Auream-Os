import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { PersistedBuilderWorkspace } from "@contracts/BuilderContracts";
import { requestBuilderApi } from "./requestBuilderApi";

/**
 * Guarda el borrador. `baseRevision` es la revisión sobre la que se editó
 * (bloqueo optimista, C4): si el servidor ya tiene otra, responde 409.
 */
export async function saveBuilderDraft(
  flowKey: string,
  draft: BuilderFlowSnapshot,
  baseRevision: number
): Promise<PersistedBuilderWorkspace> {
  return requestBuilderApi<PersistedBuilderWorkspace>(`/api/builder/flows/${flowKey}/draft`, {
    method: "PUT",
    body: JSON.stringify({ draft, baseRevision })
  });
}
