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
/** Límites de una cuenta mientras no existan por plan (FASE F). */
export const DEFAULT_TENANT_LIMITS = { maxActiveSessions: 10_000, maxWebhookRetries: 3 } as const;

/**
 * Cualquier cuenta, con la zona horaria por defecto de la plataforma (sin
 * base de datos: pruebas y almacén JSON). Con base, la zona de cada empresa
 * la lee `SqlTenantResolver` (`infrastructure/persistence/sql`).
 */
export class DefaultTimezoneTenantResolver implements TenantResolver {
  public constructor(private readonly timezone: string) {}

  public async resolve(tenantId: string): Promise<TenantContext> {
    return { tenantId, tenantKey: tenantId, timezone: this.timezone, limits: DEFAULT_TENANT_LIMITS };
  }
}
