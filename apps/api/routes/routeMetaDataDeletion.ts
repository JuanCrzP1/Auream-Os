import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetaDataDeletionService } from "../../../domains/ads/application/MetaDataDeletionService";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { clientIp, enforceRateLimit } from "../middleware/limitRequests";
import { parseFormOrJsonBody } from "../http/parseFormOrJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Avisos de Meta, sin sesión (los autoriza la firma con el secreto de la app):
//
//   POST /meta/deauthorize            alguien quitó Auream de su Facebook
//   POST /meta/data-deletion          pidió borrar sus datos → { url, confirmation_code }
//   GET  /meta/data-deletion/:code    cómo quedó la solicitud (la consulta la
//                                     página pública de eliminación de datos)
//
// Meta manda `signed_request` como formulario. Sin la app de Meta en el
// servidor responden 503 (Meta reintenta).
// ---------------------------------------------------------------------------

const POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 30 };
const STATUS = /^\/meta\/data-deletion\/([^/]+)$/;
const MAX_BODY_BYTES = 8 * 1024;

export async function routeMetaDataDeletion(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  service: MetaDataDeletionService | null | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  const path = url.pathname;
  const method = request.method ?? "GET";
  const status = STATUS.exec(path);
  const isNotice = (path === "/meta/deauthorize" || path === "/meta/data-deletion") && method === "POST";
  if (!isNotice && !(status && method === "GET")) return false;

  await enforceRateLimit(rateLimiter, `meta-deletion:${clientIp(request)}`, POLICY);
  response.setHeader("Cache-Control", "no-store");
  if (!service) {
    sendJson(response, 503, { message: "El borrado de datos de Meta no está disponible en este servidor." });
    return true;
  }
  if (status) {
    sendJson(response, 200, await service.status(decodeURIComponent(status[1]!)));
    return true;
  }
  const body = (await parseFormOrJsonBody(request, MAX_BODY_BYTES)) as Record<string, unknown>;
  if (path === "/meta/deauthorize") {
    await service.deauthorize(body["signed_request"]);
    sendJson(response, 200, { ok: true });
    return true;
  }
  sendJson(response, 200, await service.requestDeletion(body["signed_request"]));
  return true;
}
