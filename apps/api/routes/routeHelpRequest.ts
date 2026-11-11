import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestContext } from "../../../platform/identity/contracts/RequestContext";
import { HelpPermissions } from "../../../platform/authorization/permissions/HelpPermissions";
import type { HelpServices, HelpViewer } from "../../../domains/help/application/HelpServices";
import type { SupportServices } from "../../../domains/help/application/SupportServices";
import type { TutorialServices } from "../../../domains/help/application/TutorialServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// Ayuda y soporte (toda persona con sesión; lo marcado con «equipo» pide
// `help.manage`, del equipo de Auream).
//
//   GET    /help                         portada                            todos
//   GET    /help/modules/:id             artículos de un módulo             todos
//   GET    /help/articles/:slug          un artículo                        todos
//   POST   /help/articles/:slug/feedback «¿Te sirvió?»                      todos
//   GET    /help/search?q=               buscar                             todos
//   GET    /help/tutorials[?all=1]       tutoriales (borradores: equipo)    todos
//   POST   /help/tutorials/:id/seen      marcar visto                       todos
//   POST   /help/tutorials · PUT|DELETE /help/tutorials/:id · POST /help/tutorials/order   equipo
//   GET    /help/support                 contacto y mis casos               todos
//   POST   /help/support/cases           abrir un caso                      todos
//   GET    /help/support/admin?status=   todos los casos                    equipo
//   POST   /help/support/cases/:id/reply responder                          equipo
//   PUT    /help/support/settings        cómo contactar a soporte           equipo
// ---------------------------------------------------------------------------

export interface HelpRoutes {
  readonly help: HelpServices;
  readonly tutorials: TutorialServices;
  readonly support: SupportServices;
}

const ID = "([0-9a-f-]{36})";
const SLUG = "([a-z0-9-]{2,80})";
const MODULE = new RegExp(`^/help/modules/${SLUG}$`);
const ARTICLE = new RegExp(`^/help/articles/${SLUG}$`);
const FEEDBACK = new RegExp(`^/help/articles/${SLUG}/feedback$`);
const TUTORIAL = new RegExp(`^/help/tutorials/${ID}$`, "i");
const SEEN = new RegExp(`^/help/tutorials/${ID}/seen$`, "i");
const REPLY = new RegExp(`^/help/support/cases/${ID}/reply$`, "i");

function reply(response: ServerResponse, status: number, payload: unknown): true {
  sendJson(response, status, payload);
  return true;
}

function done(response: ServerResponse): true {
  response.statusCode = 204;
  response.end();
  return true;
}

export async function routeHelpRequest(request: IncomingMessage, response: ServerResponse, url: URL, module: HelpRoutes | undefined, context: RequestContext): Promise<boolean> {
  const path = url.pathname;
  if (path !== "/help" && !path.startsWith("/help/") || path.startsWith("/help/docs/")) return false;
  if (!module) return reply(response, 503, { message: "La ayuda no está disponible en este servidor." });
  const method = request.method ?? "GET";
  const viewer: HelpViewer = { tenantId: context.tenantId, userId: context.actorId, canManage: context.scopes.includes(HelpPermissions.manage) };
  const body = () => parseJsonBody<Record<string, unknown>>(request);

  if (method === "GET") {
    if (path === "/help") return reply(response, 200, await module.help.home(viewer));
    if (path === "/help/search") return reply(response, 200, { results: await module.help.search(url.searchParams.get("q") ?? "") });
    if (path === "/help/tutorials") return reply(response, 200, { tutorials: await module.tutorials.forViewer(viewer, url.searchParams.get("all") === "1") });
    if (path === "/help/support") return reply(response, 200, { settings: await module.support.settings(), cases: await module.support.mine(viewer) });
    if (path === "/help/support/admin") return reply(response, 200, { cases: await module.support.all(viewer, url.searchParams.get("status")) });
    const moduleMatch = MODULE.exec(path);
    if (moduleMatch) return reply(response, 200, { articles: await module.help.module(moduleMatch[1]!) });
    const article = ARTICLE.exec(path);
    if (article) return reply(response, 200, await module.help.article(viewer, article[1]!));
    return reply(response, 404, { message: "Not found" });
  }

  const feedback = FEEDBACK.exec(path);
  if (feedback && method === "POST") {
    const input = await body();
    await module.help.rate(viewer, feedback[1]!, input["helpful"] === true, typeof input["comment"] === "string" ? input["comment"] : null);
    return done(response);
  }
  const seen = SEEN.exec(path);
  if (seen && method === "POST") {
    await module.tutorials.markSeen(viewer, seen[1]!);
    return done(response);
  }
  if (path === "/help/support/cases" && method === "POST") return reply(response, 201, { cases: await module.support.open(viewer, await body()) });
  if (path === "/help/tutorials" && method === "POST") return reply(response, 201, { tutorials: await module.tutorials.save(viewer, null, await body()) });
  if (path === "/help/tutorials/order" && method === "POST") return reply(response, 200, { tutorials: await module.tutorials.reorder(viewer, (await body())["ids"]) });
  const tutorial = TUTORIAL.exec(path);
  if (tutorial && method === "PUT") return reply(response, 200, { tutorials: await module.tutorials.save(viewer, tutorial[1]!, await body()) });
  if (tutorial && method === "DELETE") return reply(response, 200, { tutorials: await module.tutorials.remove(viewer, tutorial[1]!) });
  const caseReply = REPLY.exec(path);
  if (caseReply && method === "POST") {
    await module.support.reply(viewer, caseReply[1]!, await body());
    return done(response);
  }
  if (path === "/help/support/settings" && method === "PUT") return reply(response, 200, await module.support.saveSettings(viewer, await body()));
  return reply(response, 405, { message: "Method not allowed" });
}
