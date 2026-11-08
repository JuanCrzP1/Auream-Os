import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CredentialPermissions } from "../../../platform/authorization/permissions/CredentialPermissions";
import type { CreateAiCredentialRequest, UpdateAiCredentialRequest } from "../../../contracts/AiContracts";
import type { IntegrationsServices } from "../composition/composeIntegrationsServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeIntegrationsRequest — `/ai-credentials`: conexiones de la cuenta con
// proveedores de IA.
//
// Ver la lista (sin claves) y sus modelos exige `credentials.read`; conectar,
// cambiar la clave, verificar o borrar, `credentials.write`. Ninguna respuesta
// lleva la clave: solo su pista. El tenant sale del contexto autenticado.
// ---------------------------------------------------------------------------

const ITEM = /^\/ai-credentials\/([^/]+)$/;
const VERIFY = /^\/ai-credentials\/([^/]+)\/verify$/;
const MODELS = /^\/ai-credentials\/([^/]+)\/models$/;

export async function routeIntegrationsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: IntegrationsServices,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/ai-credentials" && !path.startsWith("/ai-credentials/")) return false;

  const { tenantId } = context;
  const method = request.method ?? "GET";
  const isRead = method === "GET";
  requireScope(context, isRead ? CredentialPermissions.read : CredentialPermissions.write, tenantId);

  const ai = services.aiCredentials;
  if (!ai) {
    sendJson(response, 503, { message: "Las conexiones de IA no están disponibles: falta configurar el cifrado (CREDENTIALS_ENCRYPTION_KEY)." });
    return true;
  }

  if (path === "/ai-credentials" && method === "GET") {
    sendJson(response, 200, { credentials: await ai.list.execute(tenantId) });
    return true;
  }
  if (path === "/ai-credentials" && method === "POST") {
    const body = await parseJsonBody<Partial<CreateAiCredentialRequest>>(request);
    sendJson(response, 201, await ai.create.execute(tenantId, body));
    return true;
  }

  const verify = VERIFY.exec(path);
  if (verify && method === "POST") {
    sendJson(response, 200, await ai.verify.execute(tenantId, verify[1]!));
    return true;
  }

  const models = MODELS.exec(path);
  if (models && method === "GET") {
    sendJson(response, 200, { models: await ai.listModels.execute(tenantId, models[1]!) });
    return true;
  }

  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdateAiCredentialRequest>>(request);
    sendJson(response, 200, await ai.update.execute(tenantId, item[1]!, body));
    return true;
  }
  if (item && method === "DELETE") {
    await ai.remove.execute(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  sendJson(response, 404, { message: "Route not found" });
  return true;
}
