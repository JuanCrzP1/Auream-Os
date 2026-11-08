import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CredentialPermissions } from "../../../platform/authorization/permissions/CredentialPermissions";
import type { CreateAiCredentialRequest, UpdateAiCredentialRequest } from "../../../contracts/AiContracts";
import type { CreatePixelConnectionRequest, UpdatePixelConnectionRequest } from "../../../contracts/PixelContracts";
import type { IntegrationsServices } from "../composition/composeIntegrationsServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeIntegrationsRequest — conexiones de la cuenta con servicios externos:
// `/ai-credentials` (proveedores de IA) y `/pixel-connections` (píxeles de Meta).
//
// Ver la lista (sin claves) y sus modelos exige `credentials.read`; conectar,
// cambiar la clave, verificar o borrar, `credentials.write`. Ninguna respuesta
// lleva la clave: solo su pista. El tenant sale del contexto autenticado.
// ---------------------------------------------------------------------------

const PIXEL_ITEM = /^\/pixel-connections\/([^/]+)$/;
const PIXEL_VERIFY = /^\/pixel-connections\/([^/]+)\/verify$/;
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
  if (path === "/pixel-connections" || path.startsWith("/pixel-connections/")) {
    return routePixelConnections(request, response, path, services, context);
  }
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

/**
 * `/pixel-connections`: píxeles de Meta de la cuenta. Mismos permisos que las
 * conexiones de IA; ninguna respuesta lleva el token, solo su pista.
 */
async function routePixelConnections(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  services: IntegrationsServices,
  context: RequestContext
): Promise<boolean> {
  const { tenantId } = context;
  const method = request.method ?? "GET";
  requireScope(context, method === "GET" ? CredentialPermissions.read : CredentialPermissions.write, tenantId);

  const pixels = services.pixelConnections;
  if (!pixels) {
    sendJson(response, 503, { message: "Los píxeles no están disponibles: falta configurar el cifrado (CREDENTIALS_ENCRYPTION_KEY)." });
    return true;
  }

  if (path === "/pixel-connections" && method === "GET") {
    sendJson(response, 200, { connections: await pixels.list.execute(tenantId) });
    return true;
  }
  if (path === "/pixel-connections" && method === "POST") {
    const body = await parseJsonBody<Partial<CreatePixelConnectionRequest>>(request);
    sendJson(response, 201, await pixels.create.execute(tenantId, body));
    return true;
  }
  const verify = PIXEL_VERIFY.exec(path);
  if (verify && method === "POST") {
    sendJson(response, 200, await pixels.verify.execute(tenantId, verify[1]!));
    return true;
  }
  const item = PIXEL_ITEM.exec(path);
  if (item && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdatePixelConnectionRequest>>(request);
    sendJson(response, 200, await pixels.update.execute(tenantId, item[1]!, body));
    return true;
  }
  if (item && method === "DELETE") {
    await pixels.remove.execute(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  sendJson(response, 404, { message: "Route not found" });
  return true;
}
