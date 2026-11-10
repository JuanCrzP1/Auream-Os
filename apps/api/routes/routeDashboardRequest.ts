import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { AdsPermissions } from "../../../platform/authorization/permissions/AdsPermissions";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import type { DashboardFilters } from "../../../contracts/DashboardContracts";
import type { DashboardModule } from "../composition/composeAdsServices";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Dashboard de la cuenta activa (solo lectura).
//
//   GET /dashboard/sales?from&to&connectionId&productId   Ventas      (analytics.read; el gasto, con ads.read)
//   GET /dashboard/ads?from&to&level                      Anuncios    (ads.read)
//   GET /dashboard/attention?from&to&connectionId         Atención    (analytics.read)
// ---------------------------------------------------------------------------

const ANALYTICS_READ: Scope = "analytics.read";

function filtersOf(url: URL): DashboardFilters {
  const get = (key: string) => url.searchParams.get(key) ?? undefined;
  return { from: get("from"), to: get("to"), connectionId: get("connectionId"), productId: get("productId") };
}

export async function routeDashboardRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  module: DashboardModule | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/dashboard" && !path.startsWith("/dashboard/")) return false;
  if (!module) {
    sendJson(response, 503, { message: "El Dashboard no está disponible en este servidor." });
    return true;
  }
  if ((request.method ?? "GET") !== "GET") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }
  const { tenantId } = context;
  if (path === "/dashboard/sales") {
    requireScope(context, ANALYTICS_READ, tenantId);
    sendJson(response, 200, await module.sales.overview({ tenantId, canSeeAds: context.scopes.includes(AdsPermissions.read) }, filtersOf(url)));
    return true;
  }
  if (path === "/dashboard/ads") {
    requireScope(context, AdsPermissions.read, tenantId);
    sendJson(response, 200, await module.ads.performance(tenantId, filtersOf(url), url.searchParams.get("level") ?? undefined));
    return true;
  }
  if (path === "/dashboard/attention") {
    requireScope(context, ANALYTICS_READ, tenantId);
    sendJson(response, 200, await module.attention.overview(tenantId, filtersOf(url)));
    return true;
  }
  sendJson(response, 404, { message: "Not found" });
  return true;
}
