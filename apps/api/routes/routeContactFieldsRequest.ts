import type { IncomingMessage, ServerResponse } from "node:http";
import { CONTACT_FIELD_CONFIRM_PARAM, type AdoptFieldsRequest, type SaveContactFieldRequest } from "../../../contracts/ContactFieldContracts";
import type { SaveContactFieldValuesRequest } from "../../../contracts/ContactFieldValueContracts";
import type { ContactFieldServices } from "../../../domains/contact-fields/application/ContactFieldServices";
import type { ContactFieldValueServices } from "../../../domains/contact-fields/application/ContactFieldValueServices";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { routeContactFieldToolsRequest, type ContactFieldToolRoutes } from "./routeContactFieldToolsRequest";

// ---------------------------------------------------------------------------
// Campos del cliente (Configuración › Campos y datos › Campos del cliente) y la ficha.
//
//   GET    /contact-fields                   los campos, su uso y los del sistema   contacts.read
//   GET    /contact-fields/values/:contact   la ficha: datos y de dónde salieron    contacts.read
//   PATCH  /contact-fields/values/:contact   { changes } solo lo que cambió         contacts.write
//   GET    /contact-fields/discover          lo que tus flujos ya guardan           contacts.manage
//   POST   /contact-fields                   crear { label, type, options }         contacts.manage
//   POST   /contact-fields/adopt             convertir varios datos en campos       contacts.manage
//   PATCH  /contact-fields/:id               editar nombre, tipo u opciones         contacts.manage
//   DELETE /contact-fields/:id               borrar ?confirm=<clave>                contacts.manage
//
// Los ven quienes ven contactos y los llenan quienes los editan (el Asesor
// también); los organizan dueños y administradores.
// ---------------------------------------------------------------------------

export interface ContactFieldRoutes extends ContactFieldToolRoutes {
  readonly fields: ContactFieldServices;
  readonly values: ContactFieldValueServices;
}

const ITEM = /^\/contact-fields\/([^/]+)$/;
const VALUES = /^\/contact-fields\/values\/([^/]+)$/;

export async function routeContactFieldsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ContactFieldRoutes | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/contact-fields" && !path.startsWith("/contact-fields/")) return false;
  // Ordenar, unir, deshacer y lo que vende: `routeContactFieldToolsRequest`.
  if (await routeContactFieldToolsRequest(request, response, url, services, context)) return true;
  if (!services) {
    sendJson(response, 503, { message: "Los campos del cliente no están disponibles en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";
  const canManage = context.scopes.includes(ContactPermissions.manage);

  if (path === "/contact-fields" && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    sendJson(response, 200, await services.fields.list(tenantId, canManage));
    return true;
  }

  const values = VALUES.exec(path);
  if (values && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    sendJson(response, 200, await services.values.read(tenantId, values[1]!, context.scopes.includes(ContactPermissions.write)));
    return true;
  }
  if (values && method === "PATCH") {
    requireScope(context, ContactPermissions.write, tenantId);
    const body = await parseJsonBody<Partial<SaveContactFieldValuesRequest>>(request);
    sendJson(response, 200, await services.values.update(tenantId, values[1]!, body, context.actorId));
    return true;
  }

  requireScope(context, ContactPermissions.manage, tenantId);
  if (path === "/contact-fields/discover" && method === "GET") {
    sendJson(response, 200, await services.fields.discover(tenantId));
    return true;
  }
  if (path === "/contact-fields" && method === "POST") {
    sendJson(response, 201, await services.fields.create(tenantId, await parseJsonBody<Partial<SaveContactFieldRequest>>(request)));
    return true;
  }
  if (path === "/contact-fields/adopt" && method === "POST") {
    sendJson(response, 201, { fields: await services.fields.adopt(tenantId, await parseJsonBody<Partial<AdoptFieldsRequest>>(request)) });
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    sendJson(response, 200, await services.fields.update(tenantId, item[1]!, await parseJsonBody<Partial<SaveContactFieldRequest>>(request)));
    return true;
  }
  if (item && method === "DELETE") {
    await services.fields.remove(tenantId, item[1]!, url.searchParams.get(CONTACT_FIELD_CONFIRM_PARAM));
    response.statusCode = 204;
    response.end();
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
