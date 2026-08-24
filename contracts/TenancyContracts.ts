/**
 * Contratos de la API de tenancy.
 *
 * Representación que cruza HTTP entre `apps/api` y `apps/web`. NO son las
 * entidades de dominio: `Tenant` (platform/tenancy) y `Membership`
 * (domains/team) conservan datos internos que el cliente no necesita.
 *
 * La traducción ocurre en un único punto:
 * `apps/api/http/toMyTenantsResponse.ts`.
 */
import type { Role } from "../platform/authorization/contracts/Role";

/**
 * Un tenant al que el usuario pertenece, tal como lo ve el cliente.
 *
 * `id` es el UUID canónico: es lo que el frontend devuelve en `X-Tenant-Id`
 * y lo único que el servidor acepta como selección de tenant.
 */
export interface TenantMembershipSummary {
  readonly tenantId: string;
  readonly tenantKey: string;
  readonly tenantName: string;
  readonly role: Role;
}

/** Cuerpo de `GET /me/tenants`. */
export interface MyTenantsResponse {
  readonly userId: string;
  readonly tenants: ReadonlyArray<TenantMembershipSummary>;
}
