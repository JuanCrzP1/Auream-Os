import type { RequestContext } from "../../identity/contracts/RequestContext";
import { actorFromContext } from "../application/ActorFactory";
import { TenantAccessPolicy } from "../policies/TenantAccessPolicy";
import { AccessError } from "../domain/AccessError";

const tenantPolicy = new TenantAccessPolicy();

// Guard HTTP: verifica únicamente que el actor pertenece al tenant del recurso.
// Usar cuando el endpoint no requiere un scope específico pero sí ownership de tenant.
export function requireTenantAccess(context: RequestContext, tenantId: string): void {
  const actor = actorFromContext(context);
  const decision = tenantPolicy.evaluate(actor, tenantId);

  if (!decision.granted) {
    throw new AccessError(decision.reason);
  }
}
