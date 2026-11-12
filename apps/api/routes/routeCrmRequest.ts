import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import type { ClientImport } from "../../../domains/crm/application/ClientImport";
import { requireScope } from "../../../platform/authorization/guards/requireScope";
import type { Scope } from "../../../platform/authorization/contracts/Scope";
import { CrmPermissions } from "../../../platform/authorization/permissions/CrmPermissions";
import type { BoardFilters, ImportClientsRequest, MoveDealRequest, SavePipelineRequest, UpdateDealRequest } from "../../../contracts/CrmContracts";
import type { CrmActor } from "../../../domains/crm/application/crmViews";
import type { BoardServices } from "../../../domains/crm/application/BoardServices";
import type { DealServices } from "../../../domains/crm/application/DealServices";
import type { FollowUpServices } from "../../../domains/crm/application/FollowUpServices";
import type { PipelineServices } from "../../../domains/crm/application/PipelineServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";
import { routeCrmActivity } from "./routeCrmActivity";

// ---------------------------------------------------------------------------
// CRM de la cuenta activa: embudos, tablero y el cliente en cada etapa.
//
//   GET    /crm/pipelines                                  embudos y equipo          (crm.read)
//   POST   /crm/pipelines                                  crear un embudo           (crm.manage)
//   POST   /crm/pipelines/starter                          el embudo de ejemplo      (crm.manage)
//   PATCH  /crm/pipelines/:id                              configurar                (crm.manage)
//   DELETE /crm/pipelines/:id                              quitar (las etiquetas quedan) (crm.manage)
//   GET    /crm/pipelines/:id/import?days                  cuántos clientes entrarían (crm.manage)
//   POST   /crm/pipelines/:id/import { days }              traer a los que ya tienes  (crm.manage)
//   GET    /crm/pipelines/:id/board?owner&search           tablero y números         (crm.read)
//   GET    /crm/pipelines/:id/stages/:stage/cards?offset   más de una etapa (lista)  (crm.read)
//   PUT    /crm/pipelines/:id/deals/:contact/stage         mover de etapa            (crm.write)
//   PATCH  /crm/pipelines/:id/deals/:contact               valor, producto, responsable (crm.write)
//   DELETE /crm/pipelines/:id/deals/:contact               sacar del embudo          (crm.write)
//
// Seguimientos y ficha: `routeCrmActivity`. La cuenta y quien actúa salen
// SIEMPRE del contexto verificado.
// ---------------------------------------------------------------------------

export interface CrmRoutes {
  readonly pipelines: PipelineServices;
  readonly board: BoardServices;
  readonly deals: DealServices;
  readonly followUps: FollowUpServices;
  readonly imports: ClientImport;
}

const ID = "([0-9a-f-]{36})";
const PIPELINE = new RegExp(`^/crm/pipelines/${ID}$`, "i");
const BOARD = new RegExp(`^/crm/pipelines/${ID}/board$`, "i");
const CARDS = new RegExp(`^/crm/pipelines/${ID}/stages/${ID}/cards$`, "i");
const IMPORT = new RegExp(`^/crm/pipelines/${ID}/import$`, "i");
const DEAL = new RegExp(`^/crm/pipelines/${ID}/deals/${ID}$`, "i");
const DEAL_STAGE = new RegExp(`^/crm/pipelines/${ID}/deals/${ID}/stage$`, "i");

function reply(response: ServerResponse, status: number, payload: unknown): true {
  sendJson(response, status, payload);
  return true;
}

function done(response: ServerResponse): true {
  response.statusCode = 204;
  response.end();
  return true;
}

function filtersOf(url: URL): BoardFilters {
  return { owner: url.searchParams.get("owner") ?? undefined, search: url.searchParams.get("search") ?? undefined };
}

export async function routeCrmRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  module: CrmRoutes | undefined,
  context: RequestContext
): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/crm" && !path.startsWith("/crm/")) return false;
  if (!module) {
    sendJson(response, 503, { message: "El CRM no está disponible en este servidor." });
    return true;
  }
  const method = request.method ?? "GET";
  const { tenantId } = context;
  const can = (scope: Scope) => context.scopes.includes(scope);
  const actor: CrmActor = { tenantId, userId: context.actorId, canWrite: can(CrmPermissions.write), canManage: can(CrmPermissions.manage) };

  if (await routeCrmActivity(request, response, url, module, context, actor)) return true;

  const importing = IMPORT.exec(path);
  if (importing) {
    requireScope(context, CrmPermissions.manage, tenantId);
    if (method === "GET") {
      const days = url.searchParams.get("days");
      return reply(response, 200, await module.imports.preview(actor, importing[1]!, days ? Number(days) : null));
    }
    if (method === "POST") return reply(response, 200, await module.imports.run(actor, importing[1]!, (await parseJsonBody<Partial<ImportClientsRequest>>(request)).days ?? null));
    return reply(response, 405, { message: "Method not allowed" });
  }

  if (method === "GET") {
    requireScope(context, CrmPermissions.read, tenantId);
    if (path === "/crm/pipelines") return reply(response, 200, await module.pipelines.list(actor));
    const board = BOARD.exec(path);
    if (board) return reply(response, 200, await module.board.view(actor, board[1]!, filtersOf(url)));
    const cards = CARDS.exec(path);
    if (cards) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      return reply(response, 200, await module.board.stageCards(actor, cards[1]!, cards[2]!, filtersOf(url), offset));
    }
    return reply(response, 404, { message: "Not found" });
  }

  const dealStage = DEAL_STAGE.exec(path);
  const deal = DEAL.exec(path);
  if (dealStage || deal) {
    requireScope(context, CrmPermissions.write, tenantId);
    if (dealStage && method === "PUT") {
      await module.board.move(actor, dealStage[1]!, dealStage[2]!, await parseJsonBody<Partial<MoveDealRequest>>(request));
      return done(response);
    }
    if (deal && method === "PATCH") {
      return reply(response, 200, await module.deals.update(actor, deal[1]!, deal[2]!, await parseJsonBody<Partial<UpdateDealRequest>>(request)));
    }
    if (deal && method === "DELETE") {
      await module.board.remove(actor, deal[1]!, deal[2]!);
      return done(response);
    }
    return reply(response, 405, { message: "Method not allowed" });
  }

  requireScope(context, CrmPermissions.manage, tenantId);
  if (path === "/crm/pipelines" && method === "POST") {
    return reply(response, 201, await module.pipelines.create(actor, await parseJsonBody<Partial<SavePipelineRequest>>(request)));
  }
  if (path === "/crm/pipelines/starter" && method === "POST") return reply(response, 201, await module.pipelines.createStarter(actor));
  const pipeline = PIPELINE.exec(path);
  if (pipeline && method === "PATCH") {
    return reply(response, 200, await module.pipelines.update(actor, pipeline[1]!, await parseJsonBody<Partial<SavePipelineRequest>>(request)));
  }
  if (pipeline && method === "DELETE") {
    await module.pipelines.remove(actor, pipeline[1]!);
    return done(response);
  }
  return reply(response, 405, { message: "Method not allowed" });
}
