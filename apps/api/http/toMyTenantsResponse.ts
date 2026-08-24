import type { MyTenantsResponse } from "../../../contracts/TenancyContracts";
import type { MembershipWithTenant } from "../../../domains/team/application/MembershipRepository";

// ---------------------------------------------------------------------------
// Traducción de memberships de dominio a la respuesta HTTP de `/me/tenants`.
//
// Único punto donde la forma interna se convierte en la pública. No expone
// `status` (siempre activa en esta consulta) ni datos internos del tenant.
// ---------------------------------------------------------------------------

export function toMyTenantsResponse(
  userId: string,
  memberships: ReadonlyArray<MembershipWithTenant>
): MyTenantsResponse {
  return {
    userId,
    tenants: memberships.map((entry) => ({
      tenantId: entry.membership.tenantId,
      tenantKey: entry.tenantKey,
      tenantName: entry.tenantName,
      role: entry.membership.role
    }))
  };
}
