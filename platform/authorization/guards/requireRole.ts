import type { RequestContext } from "../../identity/contracts/RequestContext";
import type { Role } from "../contracts/Role";
import { actorFromContext } from "../application/ActorFactory";
import { ROLE_SCOPES } from "../roles/RoleDefinitions";
import { AccessError } from "../domain/AccessError";

// Guard HTTP: verifica que el actor satisface un rol completo.
// Un actor satisface un rol si tiene TODOS los scopes que ese rol otorga.
// Esto permite emitir tokens con scopes en lugar de roles explícitos.
export function requireRole(context: RequestContext, role: Role): void {
  const actor = actorFromContext(context);
  const requiredScopes = ROLE_SCOPES[role];
  const missingScopes = requiredScopes.filter((s) => !actor.scopes.includes(s));

  if (missingScopes.length > 0) {
    throw new AccessError(
      `Access denied: actor does not satisfy role '${role}'. Missing scopes: ${missingScopes.join(", ")}`
    );
  }
}
