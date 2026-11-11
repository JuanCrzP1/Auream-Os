import type { IncomingMessage, ServerResponse } from "node:http";
import type { LinkService } from "../../../domains/groups/application/LinkService";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { clientIp, enforceRateLimit } from "../middleware/limitRequests";

// ---------------------------------------------------------------------------
// GET /g/<slug>[?src=anuncio] — el enlace público de una campaña de grupos.
// Sin sesión: manda al grupo de WhatsApp con cupo (302). Si la campaña no
// existe, está cerrada o no hay grupo disponible, una página corta en español
// (sin datos de la cuenta). Límite por IP para que nadie infle los clics.
// ---------------------------------------------------------------------------

const POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 30 };
const PATH = /^\/g\/([a-z0-9-]{3,40})\/?$/i;

const MESSAGES = {
  missing: ["Este enlace no existe", "Revisa que esté bien escrito o pídele el enlace a quien te lo compartió."],
  closed: ["Este grupo ya cerró", "La campaña ya no recibe personas nuevas. ¡Gracias por tu interés!"],
  unavailable: ["Estamos abriendo un grupo nuevo", "Vuelve a intentarlo en un minuto."]
} as const;

function page(response: ServerResponse, status: number, [title, text]: readonly [string, string]): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f7f5fd;font-family:system-ui,sans-serif;color:#1e1530}` +
      `main{max-width:360px;padding:32px;border-radius:24px;background:#fff;box-shadow:0 18px 40px -24px rgba(59,42,122,.5);text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#6f6582;line-height:1.5}</style>` +
      `</head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`
  );
}

export async function routeGroupLink(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  link: Pick<LinkService, "click"> | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  const match = PATH.exec(url.pathname);
  if (!match || (request.method ?? "GET") !== "GET") return false;
  if (!link) {
    page(response, 503, MESSAGES.unavailable);
    return true;
  }
  await enforceRateLimit(rateLimiter, `group-link:${clientIp(request)}`, POLICY);
  const outcome = await link.click(match[1]!, url.searchParams.get("src")).catch(() => ({ kind: "unavailable" as const }));
  if (outcome.kind === "redirect") {
    response.statusCode = 302;
    response.setHeader("Location", outcome.url);
    response.setHeader("Cache-Control", "no-store");
    response.end();
    return true;
  }
  page(response, outcome.kind === "missing" ? 404 : outcome.kind === "closed" ? 410 : 503, MESSAGES[outcome.kind]);
  return true;
}
