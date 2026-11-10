import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { AdsPermissions } from "../../../platform/authorization/permissions/AdsPermissions";
import type { ConnectMetaTokenRequest, UpdateAdAccountRequest } from "../../../contracts/AdsContracts";
import type { AdConnectionServices } from "../../../domains/ads/application/AdConnectionServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Meta Ads de la cuenta activa.
//
//   GET    /ads/accounts              conexión y cuentas publicitarias     (ads.read)
//   POST   /ads/meta/oauth            el enlace del inicio de sesión de Meta (ads.manage)
//   POST   /ads/meta/token            conectar con un token pegado         (ads.manage)
//   PATCH  /ads/accounts/:id          elegir o quitar una cuenta           (ads.manage)
//   POST   /ads/accounts/:id/sync     sincronizar ya                       (ads.manage)
//   DELETE /ads/connection            desconectar Meta (borra su gasto)    (ads.manage)
//
// La vuelta de Meta (`/ads/meta/callback`) no trae sesión: `routeAdsCallback`.
// ---------------------------------------------------------------------------

const ACCOUNT = /^\/ads\/accounts\/([0-9a-f-]{36})(\/sync)?$/i;

export async function routeAdsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: AdConnectionServices | null | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/ads" && !path.startsWith("/ads/")) return false;
  if (!services) {
    sendJson(response, 503, { message: "Meta Ads no está disponible en este servidor." });
    return true;
  }
  const method = request.method ?? "GET";
  const { tenantId } = context;
  const actor = { tenantId, userId: context.actorId, canManage: context.scopes.includes(AdsPermissions.manage) };

  if (path === "/ads/accounts" && method === "GET") {
    requireScope(context, AdsPermissions.read, tenantId);
    sendJson(response, 200, await services.status(actor));
    return true;
  }

  requireScope(context, AdsPermissions.manage, tenantId);
  if (path === "/ads/meta/oauth" && method === "POST") {
    sendJson(response, 200, services.startOAuth(actor));
    return true;
  }
  if (path === "/ads/meta/token" && method === "POST") {
    const body = await parseJsonBody<Partial<ConnectMetaTokenRequest>>(request);
    sendJson(response, 200, await services.connectWithToken(actor, body.accessToken));
    return true;
  }
  if (path === "/ads/connection" && method === "DELETE") {
    await services.disconnect(actor);
    response.statusCode = 204;
    response.end();
    return true;
  }
  const account = ACCOUNT.exec(path);
  if (account && !account[2] && method === "PATCH") {
    const body = await parseJsonBody<Partial<UpdateAdAccountRequest>>(request);
    sendJson(response, 200, await services.setEnabled(actor, account[1]!, body.enabled === true));
    return true;
  }
  if (account && account[2] && method === "POST") {
    await services.syncNow(actor, account[1]!);
    sendJson(response, 202, { queued: true });
    return true;
  }
  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
