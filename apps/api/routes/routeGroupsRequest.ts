import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import { GroupPermissions } from "../../../platform/authorization/permissions/GroupPermissions";
import type { CampaignServices, GroupActor } from "../../../domains/groups/application/CampaignServices";
import type { GroupServices } from "../../../domains/groups/application/GroupServices";
import type { PostServices } from "../../../domains/groups/application/PostServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Grupos y comunidades de la cuenta activa.
//
//   GET    /groups                          campañas y lo de este mes        (groups.read)
//   GET    /groups/list                     mis grupos                       (groups.read)
//   GET    /groups/campaigns/:id            una campaña por dentro           (groups.read)
//   POST   /groups/campaigns                crear                            (groups.manage)
//   PUT    /groups/campaigns/:id            editar (y llevarlo a sus grupos) (groups.manage)
//   POST   /groups/campaigns/:id/open|close encender o apagar el enlace      (groups.manage)
//   POST   /groups/sync                     traer los grupos de WhatsApp     (groups.manage)
//   PATCH  /groups/list/:id                 sumar a una campaña o sacarlo    (groups.manage)
//   POST   /groups/posts                    enviar o programar a grupos      (groups.manage)
//   POST   /groups/posts/:id/cancel         cancelar un envío                (groups.manage)
// ---------------------------------------------------------------------------

export interface GroupRoutes {
  readonly campaigns: CampaignServices;
  readonly groups: GroupServices;
  readonly posts: PostServices;
}

const ID = "([0-9a-f-]{36})";
const CAMPAIGN = new RegExp(`^/groups/campaigns/${ID}$`, "i");
const TOGGLE = new RegExp(`^/groups/campaigns/${ID}/(open|close)$`, "i");
const GROUP = new RegExp(`^/groups/list/${ID}$`, "i");
const CANCEL = new RegExp(`^/groups/posts/${ID}/cancel$`, "i");

function reply(response: ServerResponse, status: number, payload: unknown): true {
  sendJson(response, status, payload);
  return true;
}

export async function routeGroupsRequest(request: IncomingMessage, response: ServerResponse, url: URL, module: GroupRoutes | undefined, context: RequestContext): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/groups" && !path.startsWith("/groups/")) return false;
  if (!module) return reply(response, 503, { message: "Grupos no está disponible en este servidor." });
  const method = request.method ?? "GET";
  const { tenantId } = context;
  const actor: GroupActor = { tenantId, canManage: context.scopes.includes(GroupPermissions.manage) };

  if (method === "GET") {
    requireScope(context, GroupPermissions.read, tenantId);
    if (path === "/groups") return reply(response, 200, await module.campaigns.overview(actor));
    if (path === "/groups/list") return reply(response, 200, await module.groups.list(actor));
    const campaign = CAMPAIGN.exec(path);
    if (campaign) return reply(response, 200, await module.campaigns.detail(actor, campaign[1]!));
    return reply(response, 404, { message: "Not found" });
  }

  requireScope(context, GroupPermissions.manage, tenantId);
  if (method === "POST" && path === "/groups/campaigns") return reply(response, 201, await module.campaigns.create(actor, await parseJsonBody(request)));
  if (method === "POST" && path === "/groups/sync") return reply(response, 200, await module.groups.syncNow(actor));
  if (method === "POST" && path === "/groups/posts") return reply(response, 201, await module.posts.create(actor, await parseJsonBody(request)));
  const campaign = CAMPAIGN.exec(path);
  if (campaign && method === "PUT") return reply(response, 200, await module.campaigns.update(actor, campaign[1]!, await parseJsonBody(request)));
  const toggle = TOGGLE.exec(path);
  if (toggle && method === "POST") return reply(response, 200, await module.campaigns.setOpen(actor, toggle[1]!, toggle[2]!.toLowerCase() === "open"));
  const group = GROUP.exec(path);
  if (group && method === "PATCH") {
    const body = await parseJsonBody<{ campaignId?: unknown }>(request);
    return reply(response, 200, await module.groups.attach(actor, group[1]!, typeof body.campaignId === "string" ? body.campaignId : null));
  }
  const cancel = CANCEL.exec(path);
  if (cancel && method === "POST") return reply(response, 200, { posts: await module.posts.cancel(actor, cancel[1]!) });
  return reply(response, 405, { message: "Method not allowed" });
}
