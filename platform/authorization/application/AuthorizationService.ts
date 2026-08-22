import type { Actor } from "../contracts/Actor";
import type { Scope } from "../contracts/Scope";
import type { AccessDecision } from "../contracts/AccessDecision";
import { TenantAccessPolicy } from "../policies/TenantAccessPolicy";

// Responsabilidad única: determinar si un actor puede ejecutar
// una acción (scope) sobre un recurso de un tenant dado.
//
// No resuelve identidad (auth), no parsea requests, no lanza errores HTTP.
// Solo responde: ¿granted? y por qué no.
export class AuthorizationService {
  private readonly tenantPolicy = new TenantAccessPolicy();

  public can(actor: Actor, scope: Scope, tenantId: string): AccessDecision {
    // 1. Boundary de tenant — cross-tenant es siempre denegado.
    const tenantDecision = this.tenantPolicy.evaluate(actor, tenantId);
    if (!tenantDecision.granted) return tenantDecision;

    // 2. Scope check.
    if (!actor.scopes.includes(scope)) {
      return { granted: false, reason: `Access denied: missing scope '${scope}'` };
    }

    return { granted: true };
  }
}
