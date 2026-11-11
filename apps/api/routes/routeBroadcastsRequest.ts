import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { BroadcastPermissions } from "../../../platform/authorization/permissions/BroadcastPermissions";
import type { AudienceServices } from "../../../domains/broadcasts/application/AudienceServices";
import type { BroadcastActor, BroadcastServices } from "../../../domains/broadcasts/application/BroadcastServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Difusiones de la cuenta activa.
//
//   GET    /broadcasts                          lista y lo de este mes          (broadcasts.read)
//   GET    /broadcasts/:id                      una, con sus números y versiones (broadcasts.read)
//   GET    /broadcasts/:id/recipients?filter&offset   cada persona           (broadcasts.read)
//   POST   /broadcasts                          crear (ahora o programada)      (broadcasts.manage)
//   POST   /broadcasts/:id/pause|resume|cancel  pausar, seguir, cancelar       (broadcasts.manage)
//   POST   /broadcasts/test                     enviarme una prueba             (broadcasts.manage)
//   POST   /broadcasts/audience/preview         a cuántos les llega             (broadcasts.manage)
//   GET    /broadcasts/audiences                audiencias guardadas            (broadcasts.manage)
//   POST   /broadcasts/audiences                guardar una                     (broadcasts.manage)
//   DELETE /broadcasts/audiences/:id            quitar una                      (broadcasts.manage)
//
// La cuenta y quien actúa salen SIEMPRE del contexto verificado.
// ---------------------------------------------------------------------------

export interface BroadcastRoutes {
  readonly broadcasts: BroadcastServices;
  readonly audiences: AudienceServices;
}

const ID = "([0-9a-f-]{36})";
const ONE = new RegExp(`^/broadcasts/${ID}$`, "i");
const RECIPIENTS = new RegExp(`^/broadcasts/${ID}/recipients$`, "i");
const ACTION = new RegExp(`^/broadcasts/${ID}/(pause|resume|cancel)$`, "i");
const AUDIENCE = new RegExp(`^/broadcasts/audiences/${ID}$`, "i");

function reply(response: ServerResponse, status: number, payload: unknown): true {
  sendJson(response, status, payload);
  return true;
}

export async function routeBroadcastsRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  module: BroadcastRoutes | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/broadcasts" && !path.startsWith("/broadcasts/")) return false;
  if (!module) return reply(response, 503, { message: "Las difusiones no están disponibles en este servidor." });
  const method = request.method ?? "GET";
  const { tenantId } = context;
  const actor: BroadcastActor = { tenantId, userId: context.actorId, canManage: context.scopes.includes(BroadcastPermissions.manage) };

  if (method === "GET" && path !== "/broadcasts/audiences") {
    requireScope(context, BroadcastPermissions.read, tenantId);
    if (path === "/broadcasts") return reply(response, 200, await module.broadcasts.list(actor));
    const one = ONE.exec(path);
    if (one) return reply(response, 200, await module.broadcasts.detail(actor, one[1]!));
    const recipients = RECIPIENTS.exec(path);
    if (recipients) return reply(response, 200, await module.broadcasts.recipients(actor, recipients[1]!, url.searchParams.get("filter"), Number(url.searchParams.get("offset") ?? 0)));
    return reply(response, 404, { message: "Not found" });
  }

  requireScope(context, BroadcastPermissions.manage, tenantId);
  if (path === "/broadcasts/audiences") {
    if (method === "GET") return reply(response, 200, { audiences: await module.audiences.list(tenantId) });
    if (method === "POST") return reply(response, 201, await module.audiences.save(tenantId, await parseJsonBody(request)));
  }
  const audience = AUDIENCE.exec(path);
  if (audience && method === "DELETE") {
    await module.audiences.remove(tenantId, audience[1]!);
    response.statusCode = 204;
    response.end();
    return true;
  }
  if (method === "POST") {
    if (path === "/broadcasts") return reply(response, 201, await module.broadcasts.create(actor, await parseJsonBody(request)));
    if (path === "/broadcasts/test") return reply(response, 200, await module.broadcasts.test(actor, await parseJsonBody(request)));
    if (path === "/broadcasts/audience/preview") return reply(response, 200, await module.audiences.preview(tenantId, await parseJsonBody(request)));
    const action = ACTION.exec(path);
    if (action) {
      const id = action[1]!;
      const verb = action[2]!.toLowerCase();
      const summary = verb === "pause" ? await module.broadcasts.pause(actor, id) : verb === "resume" ? await module.broadcasts.resume(actor, id) : await module.broadcasts.cancel(actor, id);
      return reply(response, 200, summary);
    }
  }
  return reply(response, 405, { message: "Method not allowed" });
}
