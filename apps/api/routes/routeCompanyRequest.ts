import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { CompanyPermissions } from "../../../platform/authorization/permissions/CompanyPermissions";
import type { ConfirmImageRequest, ImageUploadRequest, UpdateCompanyRequest } from "../../../contracts/AccountContracts";
import type { CompanyServices } from "../../../domains/company/application/CompanyServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `/company` — la empresa de la cuenta activa (Empresa en el menú de cuenta).
//
//   GET    /company               ver nombre, logo y zona horaria (todo el equipo)
//   PATCH  /company               nombre y zona horaria            (tenant.manage)
//   POST   /company/logo/uploads  permiso para subir el logo       (tenant.manage)
//   PUT    /company/logo          usar el logo subido              (tenant.manage)
//   DELETE /company/logo          quitar el logo                   (tenant.manage)
//
// El tenant sale SIEMPRE del contexto verificado, nunca de la petición.
// ---------------------------------------------------------------------------

const PATHS = new Set(["/company", "/company/logo", "/company/logo/uploads"]);

export async function routeCompanyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  company: CompanyServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (!PATHS.has(path)) return false;
  const method = request.method ?? "GET";
  const { tenantId } = context;
  if (!company) {
    sendJson(response, 503, { message: "Los datos de la empresa no están disponibles." });
    return true;
  }

  if (path === "/company" && method === "GET") {
    sendJson(response, 200, await company.get(tenantId, context.scopes.includes(CompanyPermissions.manage)));
    return true;
  }

  requireScope(context, CompanyPermissions.manage, tenantId);

  if (path === "/company" && method === "PATCH") {
    sendJson(response, 200, await company.update(tenantId, await parseJsonBody<Partial<UpdateCompanyRequest>>(request)));
    return true;
  }
  if (path.startsWith("/company/logo") && !company.canUploadLogos) {
    sendJson(response, 503, { message: "La subida de imágenes no está disponible: falta conectar el almacén de archivos." });
    return true;
  }
  if (path === "/company/logo/uploads" && method === "POST") {
    sendJson(response, 201, await company.logoTicket(tenantId, await parseJsonBody<Partial<ImageUploadRequest>>(request)));
    return true;
  }
  if (path === "/company/logo" && method === "PUT") {
    sendJson(response, 200, await company.setLogo(tenantId, await parseJsonBody<Partial<ConfirmImageRequest>>(request)));
    return true;
  }
  if (path === "/company/logo" && method === "DELETE") {
    sendJson(response, 200, await company.removeLogo(tenantId));
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
