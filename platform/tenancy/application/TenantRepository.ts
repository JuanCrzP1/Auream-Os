import type { Tenant } from "../contracts/Tenant";

// ---------------------------------------------------------------------------
// TenantRepository — puerto
//
// Declara lo que la plataforma necesita de la persistencia de tenants. La
// implementación concreta (SQL) vive en `infrastructure/persistence/sql` y se
// inyecta desde la composición: aquí no se conoce Postgres ni Neon.
// ---------------------------------------------------------------------------

export interface TenantRepository {
  findById(tenantId: string): Promise<Tenant | null>;
  findByKey(key: string): Promise<Tenant | null>;
}
