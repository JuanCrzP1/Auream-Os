import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdConnectionServices } from "../../../domains/ads/application/AdConnectionServices";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { clientIp, enforceRateLimit } from "../middleware/limitRequests";

// ---------------------------------------------------------------------------
// GET /ads/meta/callback — la vuelta del inicio de sesión de Meta. No trae
// sesión de Auream: la cuenta sale SOLO del `state` firmado (vence en 10 min).
// Siempre termina mandando al navegador a Meta Ads › Cuentas con el resultado
// (`?meta=connected` o `?meta=error&reason=…`), nunca con datos del token.
// ---------------------------------------------------------------------------

const POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 20 };

function redirect(response: ServerResponse, location: string): void {
  response.statusCode = 302;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

export async function routeAdsCallback(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: AdConnectionServices | null | undefined,
  appOrigin: string,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  if (url.pathname !== "/ads/meta/callback" || (request.method ?? "GET") !== "GET") return false;
  const back = (query: string) => redirect(response, `${appOrigin}/meta-ads?tab=accounts&${query}`);
  if (!services) {
    back("meta=error&reason=unavailable");
    return true;
  }
  await enforceRateLimit(rateLimiter, `ads-callback:${clientIp(request)}`, POLICY);
  const denied = url.searchParams.get("error");
  if (denied) {
    back("meta=error&reason=denied");
    return true;
  }
  try {
    await services.completeOAuth(url.searchParams.get("code") ?? "", url.searchParams.get("state") ?? "");
    back("meta=connected");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "No se pudo conectar con Meta.";
    back(`meta=error&reason=${encodeURIComponent(reason.slice(0, 160))}`);
  }
  return true;
}
