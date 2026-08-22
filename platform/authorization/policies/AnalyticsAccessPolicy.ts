import type { Actor } from "../contracts/Actor";
import type { AccessDecision } from "../contracts/AccessDecision";
import { TenantAccessPolicy } from "./TenantAccessPolicy";

// Regla de negocio: leer analytics requiere pertenecer al tenant
// y tener el scope analytics.read.
export class AnalyticsAccessPolicy {
  private readonly tenantPolicy = new TenantAccessPolicy();

  public evaluate(actor: Actor, tenantId: string): AccessDecision {
    const tenantDecision = this.tenantPolicy.evaluate(actor, tenantId);
    if (!tenantDecision.granted) return tenantDecision;

    if (!actor.scopes.includes("analytics.read")) {
      return { granted: false, reason: "Access denied: missing scope 'analytics.read'" };
    }

    return { granted: true };
  }
}
