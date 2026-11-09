import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type { GetBuilderWorkspaceService } from "../../../domains/automations/builder/application/GetBuilderWorkspaceService";
import type { SimulateTurnService } from "../../../domains/automations/simulation/application/SimulateTurnService";

/**
 * `POST /api/builder/flows/:flowKey/simulate` — un turno del laboratorio de
 * pruebas: lo del lienzo contra el cliente de prueba (contrato en
 * `contracts/SimulationContracts.ts`). El flujo debe existir en la cuenta.
 */
export async function handleSimulateTurnRequest(
  request: IncomingMessage,
  response: ServerResponse,
  getWorkspaceService: GetBuilderWorkspaceService,
  simulateTurnService: SimulateTurnService,
  tenantId: string,
  flowKey: string
): Promise<void> {
  const workspace = await getWorkspaceService.execute(tenantId, flowKey);
  if (!workspace) {
    sendJson(response, 404, { message: "Automatización no encontrada" });
    return;
  }
  const body = await parseJsonBody<Record<string, unknown>>(request);
  sendJson(response, 200, await simulateTurnService.execute(tenantId, workspace, typeof body === "object" && body !== null ? body : {}));
}
