import { builderApiClient } from "@shared/http/builderApiClient";
import type { SimulationTurnRequest, SimulationTurnResponse } from "@contracts/SimulationContracts";

/** Un turno del laboratorio: lo del lienzo contra el cliente de prueba. */
export function runLabTurn(flowKey: string, request: SimulationTurnRequest): Promise<SimulationTurnResponse> {
  return builderApiClient.post<SimulationTurnResponse>(`/api/builder/flows/${encodeURIComponent(flowKey)}/simulate`, request);
}
