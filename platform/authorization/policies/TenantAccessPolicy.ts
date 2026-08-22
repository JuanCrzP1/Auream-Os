import type { Actor } from "../contracts/Actor";
import type { AccessDecision } from "../contracts/AccessDecision";

// Regla base: el actor debe pertenecer al tenant del recurso.
// Todas las demás policies componen esta.
export class TenantAccessPolicy {
  public evaluate(actor: Actor, tenantId: string): AccessDecision {
    if (actor.tenantId === tenantId) {
      return { granted: true };
    }
    return {
      granted: false,
      reason: `Access denied: actor belongs to tenant '${actor.tenantId}', not '${tenantId}'`
    };
  }
}
