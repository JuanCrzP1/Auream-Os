import type { Membership } from "../contracts/Membership";

// ---------------------------------------------------------------------------
// MembershipRepository — puerto
//
// Declara lo que el dominio necesita de la persistencia de memberships.
//
// `findActive` es el camino caliente: se ejecuta en cada petición autenticada
// para resolver el rol del usuario en el tenant seleccionado.
// ---------------------------------------------------------------------------

/** Membership enriquecida con datos del tenant, para listar "mis tenants". */
export interface MembershipWithTenant {
  readonly membership: Membership;
  readonly tenantKey: string;
  readonly tenantName: string;
}

export interface MembershipRepository {
  /** Membership activa del usuario en ese tenant, o null si no existe. */
  findActive(userId: string, tenantId: string): Promise<Membership | null>;
  /** Todas las memberships activas del usuario, con datos del tenant. */
  findActiveByUser(userId: string): Promise<ReadonlyArray<MembershipWithTenant>>;
}
