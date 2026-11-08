import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import type {
  AutomationRef,
  CreateAutomationRequest,
  SetAutomationArchivedRequest
} from "../../../contracts/AutomationContracts";
import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow";
import type { CreateAutomationService } from "../../../domains/automations/builder/application/CreateAutomationService";
import type { DuplicateAutomationService } from "../../../domains/automations/builder/application/DuplicateAutomationService";
import type { SetAutomationArchivedService } from "../../../domains/automations/catalog/application/SetAutomationArchivedService";

// ---------------------------------------------------------------------------
// Crear, duplicar y archivar una automatización.
//
// Solo traducen HTTP ↔ caso de uso: comprueban la FORMA del cuerpo y delegan.
// Las reglas (que la carpeta exista en este tenant, el nombre por defecto…)
// son del dominio, y sus errores (NotFoundError, ValidationError) los traduce
// a su código el manejador de errores de createApiServer. El tenant llega del
// contexto autenticado, nunca del cuerpo.
// ---------------------------------------------------------------------------

const toRef = (flow: AutomationFlow): AutomationRef => ({ id: flow.id, key: flow.key, name: flow.name });

/** `POST /automations` */
export async function handleCreateAutomationRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: CreateAutomationService,
  tenantId: string
): Promise<void> {
  const body = await parseJsonBody<Partial<CreateAutomationRequest>>(request);

  if (body.name !== undefined && typeof body.name !== "string") {
    sendJson(response, 400, { message: "name debe ser texto" });
    return;
  }
  if (body.folderId !== undefined && (typeof body.folderId !== "string" || body.folderId.trim() === "")) {
    sendJson(response, 400, { message: "folderId debe ser un identificador" });
    return;
  }

  const flow = await service.execute(tenantId, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.folderId !== undefined ? { folderId: body.folderId } : {})
  });
  sendJson(response, 201, toRef(flow));
}

/** `POST /automations/:id/duplicate` */
export async function handleDuplicateAutomationRequest(
  response: ServerResponse,
  service: DuplicateAutomationService,
  tenantId: string,
  flowId: string
): Promise<void> {
  const copy = await service.execute(tenantId, flowId);
  sendJson(response, 201, toRef(copy));
}

/** `PATCH /automations/:id/archive` */
export async function handleSetAutomationArchivedRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: SetAutomationArchivedService,
  tenantId: string,
  flowId: string
): Promise<void> {
  const body = await parseJsonBody<Partial<SetAutomationArchivedRequest>>(request);

  if (typeof body.archived !== "boolean") {
    sendJson(response, 400, { message: "archived debe ser true o false" });
    return;
  }

  const flow = await service.execute(tenantId, flowId, body.archived);
  sendJson(response, 200, toRef(flow));
}
