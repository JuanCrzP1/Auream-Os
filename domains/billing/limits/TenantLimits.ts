import type { TenantCapabilities } from "../contracts/TenantCapabilities";

// Responsabilidad única: comprobar si un tenant ha alcanzado sus límites.
// Stateless — solo envuelve las capabilities con métodos semánticos.
export class TenantLimits {
  public constructor(private readonly capabilities: TenantCapabilities) {}

  public canCreateFlow(currentFlowCount: number): boolean {
    return currentFlowCount < this.capabilities.maxFlows;
  }

  public canExecute(currentMonthExecutions: number): boolean {
    return currentMonthExecutions < this.capabilities.maxExecutionsPerMonth;
  }

  public canAddAgent(currentAgentCount: number): boolean {
    return currentAgentCount < this.capabilities.maxAgents;
  }

  public hasAi(): boolean {
    return this.capabilities.aiEnabled;
  }

  public hasAnalytics(): boolean {
    return this.capabilities.analyticsEnabled;
  }

  public hasIntegrations(): boolean {
    return this.capabilities.integrationsEnabled;
  }

  public hasCustomBranding(): boolean {
    return this.capabilities.customBrandingEnabled;
  }
}
