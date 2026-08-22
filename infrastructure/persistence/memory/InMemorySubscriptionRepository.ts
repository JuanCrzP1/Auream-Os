import type { Subscription } from "../../../domains/billing/contracts/Subscription";
import type { SubscriptionRepository } from "../../../domains/billing/subscriptions/SubscriptionRepository";

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly store = new Map<string, Subscription>();

  public findByTenant(tenantId: string): Subscription | undefined {
    return this.store.get(tenantId);
  }

  public save(subscription: Subscription): void {
    this.store.set(subscription.tenantId, subscription);
  }
}
