import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import { SimulateDraftService } from "../../../domains/automations/builder/application/SimulateDraftService";
import type { BuilderSimulationRequest } from "../../../contracts/BuilderContracts";

export async function handleSimulateDraftRequest(
  request: IncomingMessage,
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  simulateDraftService: SimulateDraftService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  const body = await parseJsonBody<BuilderSimulationRequest>(request);
  const result = simulateDraftService.simulate(workspace, body);
  sendJson(response, 200, result);
}