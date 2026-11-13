import type { IncomingMessage, ServerResponse } from "node:http";
import type { ContactFieldMergeServices } from "../../../domains/contact-fields/application/ContactFieldMergeServices";
import type { ContactFieldTidyServices } from "../../../domains/contact-fields/application/ContactFieldTidyServices";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { ContactPermissions } from "../../../platform/authorization/permissions/ContactPermissions";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Herramientas del catálogo de Campos del cliente (ver
// `contracts/ContactFieldToolsContracts.ts`): ordenar valores, unir campos,
// deshacer y lo que vende cada valor. Ordenar, unir y deshacer son de dueños y
// administradores; lo que vende lo ve quien ve contactos Y ventas.
// ---------------------------------------------------------------------------

export interface ContactFieldToolRoutes {
  readonly tidy: ContactFieldTidyServices;
  readonly merge: ContactFieldMergeServices;
}

const FIELD_TOOL = /^\/contact-fields\/([^/]+)\/(values|tidy|sales)$/;
const UNDO = /^\/contact-fields\/operations\/([^/]+)\/undo$/;

/** `false` si la ruta no es de las herramientas (la sigue `routeContactFieldsRequest`). */
export async function routeContactFieldToolsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: ContactFieldToolRoutes | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  const tool = FIELD_TOOL.exec(path);
  const undo = UNDO.exec(path);
  const merge = path === "/contact-fields/merge" || path === "/contact-fields/merge/preview";
  if (!services || (!tool && !undo && !merge)) return false;
  const { tenantId } = context;
  const method = request.method ?? "GET";

  if (tool?.[2] === "sales" && method === "GET") {
    requireScope(context, ContactPermissions.read, tenantId);
    requireScope(context, SalesPermissions.read, tenantId);
    sendJson(response, 200, await services.tidy.sales(tenantId, tool[1]!, url.searchParams.get("days") ?? undefined));
    return true;
  }

  requireScope(context, ContactPermissions.manage, tenantId);
  if (tool?.[2] === "values" && method === "GET") {
    sendJson(response, 200, await services.tidy.values(tenantId, tool[1]!));
    return true;
  }
  if (tool?.[2] === "tidy" && method === "POST") {
    sendJson(response, 200, await services.tidy.tidy(tenantId, tool[1]!, await parseJsonBody<unknown>(request), context.actorId));
    return true;
  }
  if (path === "/contact-fields/merge/preview" && method === "POST") {
    sendJson(response, 200, await services.merge.preview(tenantId, await parseJsonBody<unknown>(request)));
    return true;
  }
  if (path === "/contact-fields/merge" && method === "POST") {
    sendJson(response, 200, await services.merge.merge(tenantId, await parseJsonBody<unknown>(request), context.actorId));
    return true;
  }
  if (undo && method === "POST") {
    sendJson(response, 200, await services.merge.undo(tenantId, undo[1]!));
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
