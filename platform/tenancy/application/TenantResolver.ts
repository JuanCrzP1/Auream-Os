import type { TenantContext } from "../../../contracts/RuntimeContracts";

export interface TenantResolver {
  resolve(tenantId: string): TenantContext;
}

export class StaticTenantResolver implements TenantResolver {
  public constructor(private readonly tenants: Record<string, TenantContext>) {}

  public resolve(tenantId: string): TenantContext {
    const tenant = this.tenants[tenantId];

    if (!tenant) {
      throw new Error(`Tenant no encontrado: ${tenantId}`);
    }

    return tenant;
  }
}