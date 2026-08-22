import type { Actor } from "../contracts/Actor";
import type { AccessDecision } from "../contracts/AccessDecision";
import { TenantAccessPolicy } from "./TenantAccessPolicy";

// Regla de negocio: ejecutar/simular un flow requiere pertenecer al tenant
// y tener el scope runtime.execute.
export class RuntimeExecutionPolicy {
  private readonly tenantPolicy = new TenantAccessPolicy();

  public evaluate(actor: Actor, tenantId: string): AccessDecision {
    const tenantDecision = this.tenantPolicy.evaluate(actor, tenantId);
    if (!tenantDecision.granted) return tenantDecision;

    if (!actor.scopes.includes("runtime.execute")) {
      return { granted: false, reason: "Access denied: missing scope 'runtime.execute'" };
    }

    return { granted: true };
  }
}
