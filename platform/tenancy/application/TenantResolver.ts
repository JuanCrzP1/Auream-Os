import type { TenantContext } from "../../../contracts/RuntimeContracts";

export interface TenantResolver {
  resolve(tenantId: string): Promise<TenantContext>;
}

export class StaticTenantResolver implements TenantResolver {
  public constructor(private readonly tenants: Record<string, TenantContext>) {}

  public async resolve(tenantId: string): Promise<TenantContext> {
    const tenant = this.tenants[tenantId];

    if (!tenant) {
      throw new Error(`Tenant no encontrado: ${tenantId}`);
    }

    return tenant;
  }
}