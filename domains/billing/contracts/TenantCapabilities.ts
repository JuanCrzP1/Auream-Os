import type { PlanId } from "./Plan";

// Capacidades efectivas de un tenant según su plan.
// Infinity indica sin límite (solo para enterprise).
export interface TenantCapabilities {
  readonly planId: PlanId;
  readonly maxFlows: number;
  readonly maxExecutionsPerMonth: number;
  readonly maxAgents: number;
  readonly aiEnabled: boolean;
  readonly analyticsEnabled: boolean;
  readonly integrationsEnabled: boolean;
  readonly customBrandingEnabled: boolean;
}
