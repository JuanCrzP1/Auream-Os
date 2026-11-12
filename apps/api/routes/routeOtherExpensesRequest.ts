import type { IncomingMessage, ServerResponse } from "node:http";
import type { SaveOtherExpenseRequest } from "../../../contracts/OtherExpenseContracts";
import type { OtherExpenseServices } from "../../../domains/expenses/application/OtherExpenseServices";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { SalesPermissions } from "../../../platform/authorization/permissions/SalesPermissions";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// routeOtherExpensesRequest — `/other-expenses`: los gastos fuera de Meta.
//
//   GET    /other-expenses       los de la cuenta (+ canManage)     ads.read
//   POST   /other-expenses       crear { name, kind, amount,         sales.manage
//                                currency, frequency, startsOn,
//                                endsOn, lineId }
//   PATCH  /other-expenses/:id   editar (lo que no llega no cambia) sales.manage
//   DELETE /other-expenses/:id   borrar (solo cambia la ganancia)   sales.manage
//
// Los ve quien ve el gasto en anuncios (con la ganancia se deducirían); los
// manejan dueños y administradores (los mismos que el catálogo y las líneas).
// ---------------------------------------------------------------------------

const ADS_READ: Scope = "ads.read";
const ITEM = /^\/other-expenses\/([0-9a-f-]{36})$/i;

export async function routeOtherExpensesRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: OtherExpenseServices | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/other-expenses" && !path.startsWith("/other-expenses/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Los otros gastos no están disponibles en este servidor." });
    return true;
  }
  const { tenantId } = context;
  const method = request.method ?? "GET";

  if (path === "/other-expenses" && method === "GET") {
    requireScope(context, ADS_READ, tenantId);
    sendJson(response, 200, await services.list(tenantId, context.scopes.includes(SalesPermissions.manage)));
    return true;
  }

  requireScope(context, SalesPermissions.manage, tenantId);
  if (path === "/other-expenses" && method === "POST") {
    sendJson(response, 201, await services.create(tenantId, await parseJsonBody<Partial<SaveOtherExpenseRequest>>(request)));
    return true;
  }
  const item = ITEM.exec(path);
  if (item && method === "PATCH") {
    sendJson(response, 200, await services.update(tenantId, item[1]!, await parseJsonBody<Partial<SaveOtherExpenseRequest>>(request)));
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
