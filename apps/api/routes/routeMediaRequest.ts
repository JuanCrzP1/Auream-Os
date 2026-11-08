import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { FlowPermissions } from "../../../platform/authorization/permissions/FlowPermissions";
import type { MediaUploadRequest, RegisterMediaRequest } from "../../../contracts/MediaContracts";
import type { MediaServices } from "../composition/composeMediaServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeMediaRequest — subir medios para los bloques.
//
//   POST /media/uploads   permiso de subida de un solo uso   (flows.write)
//   POST /media           registrar una subida terminada     (flows.write)
//
// Los bytes nunca pasan por aquí: van del navegador al almacén.
// ---------------------------------------------------------------------------

export async function routeMediaRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: MediaServices | null,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/media" && path !== "/media/uploads") return false;
  if (request.method !== "POST") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }

  requireScope(context, FlowPermissions.write, context.tenantId);
  if (!services) {
    sendJson(response, 503, { message: "La subida de archivos no está disponible: falta conectar el almacén de archivos." });
    return true;
  }

  if (path === "/media/uploads") {
    const body = await parseJsonBody<Partial<MediaUploadRequest>>(request);
    sendJson(response, 201, await services.createUpload.execute(context.tenantId, body));
    return true;
  }

  const body = await parseJsonBody<Partial<RegisterMediaRequest>>(request);
  sendJson(response, 201, await services.register.execute(context.tenantId, body));
  return true;
}

/**
 * Almacén local (solo desarrollo), SIN sesión: la subida la autoriza el
 * permiso firmado y los archivos son públicos como en Vercel Blob.
 *
 *   PUT /media/local/upload?ticket=…
 *   GET /media/local/files/<ruta>
 */
export async function routeLocalMediaRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: MediaServices | null
): Promise<boolean> {
  const local = services?.local;
  if (!local || !url.pathname.startsWith("/media/local/")) return false;

  if (url.pathname === "/media/local/upload" && request.method === "PUT") {
    await local.receiveUpload(request, response, url.searchParams.get("ticket") ?? "");
    return true;
  }
  if (url.pathname.startsWith("/media/local/files/") && request.method === "GET") {
    await local.serve(response, decodeURIComponent(url.pathname.slice("/media/local/files/".length)));
    return true;
  }
  sendJson(response, 404, { message: "Route not found" });
  return true;
}
