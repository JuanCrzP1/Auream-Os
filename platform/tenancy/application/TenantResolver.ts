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
const DEFAULT_LIMITS = { maxActiveSessions: 10_000, maxWebhookRetries: 3 } as const;

/**
 * Cualquier cuenta, con la zona horaria por defecto de la plataforma. Las
 * cuentas aún no guardan su zona; cuando la tengan, este resolvedor se
 * cambia por uno que la lea de `tenants`.
 */
export class DefaultTimezoneTenantResolver implements TenantResolver {
  public constructor(private readonly timezone: string) {}

  public async resolve(tenantId: string): Promise<TenantContext> {
    return { tenantId, tenantKey: tenantId, timezone: this.timezone, limits: DEFAULT_LIMITS };
  }
}
