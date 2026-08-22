import type { Actor } from "../contracts/Actor";
import type { AccessDecision } from "../contracts/AccessDecision";
import { TenantAccessPolicy } from "./TenantAccessPolicy";

// Regla de negocio: publicar un flow requiere pertenecer al tenant
// y tener el scope flows.publish.
// Punto de extensión: aquí irán reglas futuras (aprobaciones, estado del draft, etc.).
export class PublishFlowPolicy {
  private readonly tenantPolicy = new TenantAccessPolicy();

  public evaluate(actor: Actor, tenantId: string): AccessDecision {
    const tenantDecision = this.tenantPolicy.evaluate(actor, tenantId);
    if (!tenantDecision.granted) return tenantDecision;

    if (!actor.scopes.includes("flows.publish")) {
      return { granted: false, reason: "Access denied: missing scope 'flows.publish'" };
    }

    return { granted: true };
  }
}
