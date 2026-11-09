import type { AutomationListResponse } from "@contracts/AutomationContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

/** Un flujo que se puede elegir (disparadores, enviar a mano). */
export interface FlowOption {
  readonly id: string;
  readonly name: string;
}

/** Los flujos de la cuenta que se pueden usar (sin archivados), por nombre. */
export async function fetchFlowOptions(): Promise<FlowOption[]> {
  const catalog = await builderApiClient.get<AutomationListResponse>("/automations");
  return catalog.flows
    .filter((flow) => flow.status !== "archived")
    .map((flow) => ({ id: flow.id, name: flow.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
