import type { IncomingMessage, ServerResponse } from "node:http";
import { CONTACT_FIELD_CONFIRM_PARAM, type AdoptFieldsRequest, type SaveContactFieldRequest } from "../../../contracts/ContactFieldContracts";
import type { ContactFieldServices } from "../../../domains/contact-fields/application/ContactFieldServices";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Campos del cliente (Configuración › Datos › Campos del cliente).
//
//   GET    /contact-fields            los campos, su uso y los del sistema    contacts.read
//   GET    /contact-fields/discover   lo que tus flujos ya guardan            contacts.manage
//   POST   /contact-fields            crear { label, type, options }          contacts.manage
//   POST   /contact-fields/adopt      convertir varios datos en campos        contacts.manage
//   PATCH  /contact-fields/:id        editar nombre, tipo u opciones          contacts.manage
//   DELETE /contact-fields/:id        borrar ?confirm=<clave>                 contacts.manage
//
// Los ven quienes ven contactos; los organizan dueños y administradores.
// ---------------------------------------------------------------------------

const ITEM = /^\/contact-fields\/([^/]+)$/;

export async function routeContactFieldsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ContactFieldServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/contact-fields" && !path.startsWith("/contact-fields/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Los campos del cliente no están disponibles en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";
  const canManage = context.scopes.includes(ContactPermissions.manage);

  if (path === "/contact-fields" && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    sendJson(response, 200, await services.list(tenantId, canManage));
    return true;
  }

  requireScope(context, ContactPermissions.manage, tenantId);
  if (path === "/contact-fields/discover" && method === "GET") {
    sendJson(response, 200, await services.discover(tenantId));
    return true;
  }
  if (path === "/contact-fields" && method === "POST") {
    sendJson(response, 201, await services.create(tenantId, await parseJsonBody<Partial<SaveContactFieldRequest>>(request)));
    return true;
  }
  if (path === "/contact-fields/adopt" && method === "POST") {
    sendJson(response, 201, { fields: await services.adopt(tenantId, await parseJsonBody<Partial<AdoptFieldsRequest>>(request)) });
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    sendJson(response, 200, await services.update(tenantId, item[1]!, await parseJsonBody<Partial<SaveContactFieldRequest>>(request)));
    return true;
  }
  if (item && method === "DELETE") {
    await services.remove(tenantId, item[1]!, url.searchParams.get(CONTACT_FIELD_CONFIRM_PARAM));
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
