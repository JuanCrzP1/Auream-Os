import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { toAutomationFolderSummary } from "../http/toAutomationListResponse";
import type { CreateFolderRequest } from "../../../contracts/AutomationContracts";
import type { CreateFolderService } from "../../../domains/automations/catalog/application/CreateFolderService";

/**
 * handleCreateFolderRequest — `POST /automations/folders`.
 *
 * Responsabilidad única: traducir HTTP ↔ caso de uso.
 *
 * Comprueba que el cuerpo tenga la FORMA del contrato (eso sí es del
 * transporte) y delega. Si el nombre es válido lo decide CreateFolderService:
 * su ValidationError llega al manejador de errores de createApiServer, que ya
 * traduce cualquier DomainError a su statusCode. Duplicar esa validación aquí
 * sería una segunda regla que puede divergir de la del dominio.
 *
 * El tenant llega del contexto autenticado, nunca del cuerpo: aceptarlo del
 * cliente permitiría crear carpetas en un tenant ajeno.
 */
export async function handleCreateFolderRequest(
  request: IncomingMessage,
  response: ServerResponse,
  createFolderService: CreateFolderService,
  tenantId: string
): Promise<void> {
  const body = await parseJsonBody<Partial<CreateFolderRequest>>(request);

  if (typeof body.name !== "string") {
    sendJson(response, 400, { message: "name es obligatorio" });
    return;
  }

  const folder = await createFolderService.execute(tenantId, body.name);
  sendJson(response, 201, toAutomationFolderSummary(folder));
}
