import type { RequestContext } from "../../identity/contracts/RequestContext";
import type { Scope } from "../contracts/Scope";
import { actorFromContext } from "../application/ActorFactory";
import { AuthorizationService } from "../application/AuthorizationService";
import { AccessError } from "../domain/AccessError";

const authorizationService = new AuthorizationService();

// Guard HTTP: lanza AccessError (403) si el actor no tiene el scope
// sobre el tenant dado. La route llama esto antes de despachar al handler.
export function requireScope(
  context: RequestContext,
  scope: Scope,
  tenantId: string
): void {
  const actor = actorFromContext(context);
  const decision = authorizationService.can(actor, scope, tenantId);

  if (!decision.granted) {
    throw new AccessError(decision.reason);
  }
}
