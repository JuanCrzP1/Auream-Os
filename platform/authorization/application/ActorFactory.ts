import type { RequestContext } from "../../identity/contracts/RequestContext";
import type { Actor } from "../contracts/Actor";
import type { Scope } from "../contracts/Scope";

// Scopes reconocidos — filtra valores desconocidos que pudieran venir de tokens corruptos.
const KNOWN_SCOPES: ReadonlySet<string> = new Set<Scope>([
  "flows.read",
  "flows.write",
  "flows.publish",
  "runtime.execute",
  "analytics.read",
  "contacts.read",
  "contacts.write",
  "credentials.read",
  "credentials.write",
  "connections.read",
  "connections.write",
  "conversations.read",
  "conversations.write",
  "tenant.manage",
  "team.read",
  "team.manage"
]);

// Convierte un RequestContext (capa de auth) en un Actor (capa de access).
// Punto de traducción único entre los dos módulos.
export function actorFromContext(context: RequestContext): Actor {
  return {
    actorId: context.actorId,
    tenantId: context.tenantId,
    scopes: context.scopes.filter((s): s is Scope => KNOWN_SCOPES.has(s))
  };
}
