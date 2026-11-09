import type { IncomingMessage, ServerResponse } from "node:http";
import { WEBHOOK_LIMITS } from "../../../contracts/WebhookContracts";
import { INBOUND_WEBHOOK_PATH } from "../../../domains/webhooks/application/WebhookAdminServices";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { WebhookServices } from "../composition/composeWebhookServices";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import { enforceRateLimit } from "../middleware/limitRequests";
import { parseFormOrJsonBody } from "../http/parseFormOrJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `POST /hooks/in/<id>/<secreto>` — donde otros sistemas (n8n, Make, Hotmart,
// formularios…) envían datos a un webhook de entrada. No lleva sesión: la
// autoriza el secreto de la dirección. Acepta JSON y formularios
// (`application/x-www-form-urlencoded`).
//
// Responde enseguida (202) y procesa en segundo plano: el resultado queda en
// el historial del webhook. Una dirección que no existe, o con otro secreto,
// recibe 404 (sin decir cuál de las dos). Límite: 600 envíos por minuto por
// webhook.
// ---------------------------------------------------------------------------

const ROUTE = new RegExp(`^${INBOUND_WEBHOOK_PATH}/([^/]+)/([^/]+)$`);
export const INBOUND_WEBHOOK_POLICY = { windowMs: 60_000, maxRequests: 600 };

export async function routeInboundWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  services: WebhookServices | null | undefined,
  background: BackgroundTasks | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  const match = ROUTE.exec(url.pathname);
  if (!match) return false;
  if ((request.method ?? "GET") !== "POST") {
    sendJson(response, 405, { message: "Envía los datos con POST." });
    return true;
  }
  if (!services || !background) {
    sendJson(response, 503, { message: "Los webhooks no están disponibles." });
    return true;
  }
  const [, id, secret] = match as unknown as [string, string, string];
  await enforceRateLimit(rateLimiter, `hook:${id}`, INBOUND_WEBHOOK_POLICY);
  const webhook = await services.receive.authenticate(id, decodeURIComponent(secret));
  if (!webhook) {
    sendJson(response, 404, { message: "No encontrado." });
    return true;
  }
  const payload = await parseFormOrJsonBody(request, WEBHOOK_LIMITS.payloadBytes);
  if (typeof payload !== "object" || payload === null) {
    sendJson(response, 400, { message: "El envío debe ser un objeto JSON." });
    return true;
  }
  background.run(() => services.receive.process(webhook, payload));
  sendJson(response, 202, { received: true });
  return true;
}
