import type { PlanId } from "./Plan";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled";

export interface Subscription {
  readonly tenantId: string;
  readonly planId: PlanId;
  readonly status: SubscriptionStatus;
  readonly validUntil: string; // ISO 8601
  readonly createdAt: string;  // ISO 8601
}
