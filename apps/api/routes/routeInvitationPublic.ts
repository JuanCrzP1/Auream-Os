import type { IncomingMessage, ServerResponse } from "node:http";
import type { InvitationServices } from "../../../domains/team/application/InvitationServices";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { RateLimitPolicy } from "../../../platform/security/rate-limiting/contracts/RateLimitPolicy";
import { clientIp, enforceRateLimit } from "../middleware/limitRequests";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `GET /invitations/:token` — lo que ve quien abre un enlace de invitación,
// todavía SIN sesión (puede no tener cuenta): la empresa, quién invita, el rol
// y el correo a medias. Lo autoriza el secreto del enlace, no una sesión.
// Aceptar sí exige sesión: `POST /me/invitations/:token/accept`.
//
// El secreto tiene 256 bits (adivinarlo no es viable); igual se limita por IP.
// ---------------------------------------------------------------------------

export const INVITATION_PREVIEW_POLICY: RateLimitPolicy = { windowMs: 60_000, maxRequests: 30 };

const PREVIEW = /^\/invitations\/([A-Za-z0-9_-]{1,100})$/;

export async function routeInvitationPublic(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  invitations: InvitationServices | undefined,
  rateLimiter: RateLimiter | undefined
): Promise<boolean> {
  const match = PREVIEW.exec(url.pathname);
  if (!match || request.method !== "GET") return false;
  if (!invitations) {
    sendJson(response, 503, { message: "Las invitaciones no están disponibles en este servidor." });
    return true;
  }
  await enforceRateLimit(rateLimiter, `invite:preview:${clientIp(request)}`, INVITATION_PREVIEW_POLICY);
  sendJson(response, 200, await invitations.preview(match[1]!));
  return true;
}
