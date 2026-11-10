import type { TenantContext } from "../../../contracts/RuntimeContracts";
import { DEFAULT_TENANT_LIMITS, type TenantResolver } from "../../../platform/tenancy/application/TenantResolver";
import type { SqlExecutor } from "./SqlClient";

// ---------------------------------------------------------------------------
// SqlTenantResolver — lo que el motor necesita de una cuenta en ejecución,
// con SU zona horaria (`tenants.timezone`, la que eligió en Empresa). Si no
// eligió una, o la base no responde, rige la de la plataforma: el motor nunca
// se detiene por esto.
//
// Recuerda cada zona `ttlMs` por instancia: un cambio en Empresa llega a los
// flujos en menos de ese tiempo, sin una consulta por cada turno.
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 30_000;

export class SqlTenantResolver implements TenantResolver {
  private readonly cache = new Map<string, { readonly timezone: string | null; readonly at: number }>();

  public constructor(
    private readonly sql: SqlExecutor,
    private readonly defaultTimezone: string,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  public async resolve(tenantId: string): Promise<TenantContext> {
    const timezone = (await this.timezoneOf(tenantId)) ?? this.defaultTimezone;
    return { tenantId, tenantKey: tenantId, timezone, limits: DEFAULT_TENANT_LIMITS };
  }

  private async timezoneOf(tenantId: string): Promise<string | null> {
    const cached = this.cache.get(tenantId);
    if (cached && this.now() - cached.at < this.ttlMs) return cached.timezone;
    try {
      const result = await this.sql.query<{ timezone: string | null }>("select timezone from tenants where id = $1", [tenantId]);
      const timezone = result.rows[0]?.timezone ?? null;
      this.cache.set(tenantId, { timezone, at: this.now() });
      return timezone;
    } catch {
      // Sin base no se cambia nada: la última conocida, o la de la plataforma.
      return cached?.timezone ?? null;
    }
  }
}
