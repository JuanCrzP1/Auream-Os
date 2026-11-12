import type { IncomingMessage, ServerResponse } from "node:http";
import type { SaveSalesLineRequest } from "../../../contracts/SalesLineContracts";
import type { SalesLineServices } from "../../../domains/sales-lines/application/SalesLineServices";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeSalesLinesRequest — `/sales-lines`: las líneas de venta de la cuenta.
//
//   GET    /sales-lines        las de la cuenta (+ canManage)      analytics.read
//   POST   /sales-lines        crear { name, color, productIds,     sales.manage
//                              connectionIds, campaignIds }
//   PATCH  /sales-lines/:id    editar (lo que no llega no cambia)  sales.manage
//   DELETE /sales-lines/:id    borrar (no toca ventas)             sales.manage
//
// Las ve todo el equipo que ve el Dashboard; las organizan dueños y
// administradores (los mismos que manejan el catálogo).
// ---------------------------------------------------------------------------

const ANALYTICS_READ: Scope = "analytics.read";
const ITEM = /^\/sales-lines\/([0-9a-f-]{36})$/i;

export async function routeSalesLinesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: SalesLineServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/sales-lines" && !path.startsWith("/sales-lines/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Las líneas de venta no están disponibles en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";
  const canManage = context.scopes.includes(SalesPermissions.manage);

  if (path === "/sales-lines" && method === "GET") {
    requireScope(context, ANALYTICS_READ, tenantId);
    sendJson(response, 200, await services.list(tenantId, canManage));
    return true;
  }

  requireScope(context, SalesPermissions.manage, tenantId);
  if (path === "/sales-lines" && method === "POST") {
    sendJson(response, 201, await services.create(tenantId, await parseJsonBody<Partial<SaveSalesLineRequest>>(request)));
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    sendJson(response, 200, await services.update(tenantId, item[1]!, await parseJsonBody<Partial<SaveSalesLineRequest>>(request)));
    return true;
  }
  if (item && method === "DELETE") {
    await services.remove(tenantId, item[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
