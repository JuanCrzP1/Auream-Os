import type { PlanId } from "../contracts/Plan";
import type { TenantCapabilities } from "../contracts/TenantCapabilities";

// Fuente de verdad: qué capacidades otorga cada plan.
// Cambiar aquí afecta a todos los tenants con ese plan.
export const PLAN_CAPABILITIES: Readonly<Record<PlanId, TenantCapabilities>> = {
  free: {
    planId: "free",
    maxFlows: 3,
    maxExecutionsPerMonth: 1_000,
    maxAgents: 1,
    aiEnabled: false,
    analyticsEnabled: false,
    integrationsEnabled: false,
    customBrandingEnabled: false
  },
  pro: {
    planId: "pro",
    maxFlows: 25,
    maxExecutionsPerMonth: 50_000,
    maxAgents: 5,
    aiEnabled: true,
    analyticsEnabled: true,
    integrationsEnabled: true,
    customBrandingEnabled: false
  },
  enterprise: {
    planId: "enterprise",
    maxFlows: Infinity,
    maxExecutionsPerMonth: Infinity,
    maxAgents: Infinity,
    aiEnabled: true,
    analyticsEnabled: true,
    integrationsEnabled: true,
    customBrandingEnabled: true
  }
} as const;
