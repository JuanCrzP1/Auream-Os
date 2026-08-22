import type { TenantCapabilities } from "../contracts/TenantCapabilities";
import type { SubscriptionRepository } from "../subscriptions/SubscriptionRepository";
import { PLAN_CAPABILITIES } from "../plans/PlanDefinitions";

// Responsabilidad única: dada una suscripción, resolver las capabilities del tenant.
// Sin suscripción activa → plan free (degradación segura).
export class CapabilityResolver {
  public constructor(private readonly subscriptionRepo: SubscriptionRepository) {}

  public resolve(tenantId: string): TenantCapabilities {
    const subscription = this.subscriptionRepo.findByTenant(tenantId);

    if (!subscription || subscription.status !== "active") {
      return PLAN_CAPABILITIES["free"];
    }

    return PLAN_CAPABILITIES[subscription.planId];
  }
}
