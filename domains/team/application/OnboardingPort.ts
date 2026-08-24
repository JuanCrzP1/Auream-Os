import type { Membership } from "../contracts/Membership";

// ---------------------------------------------------------------------------
// OnboardingPort — puerto
//
// Declara la única operación de alta de un usuario nuevo: crear su tenant
// inicial y su membership en un solo acto atómico.
//
// Es un puerto separado de `MembershipRepository` porque es una ESCRITURA
// transaccional que abarca dos tablas, no una lectura de memberships.
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  readonly tenantId: string;
  readonly tenantKey: string;
  readonly tenantName: string;
  readonly membership: Membership;
  /** false si el usuario ya tenía tenant y no se creó nada. */
  readonly created: boolean;
}

export interface OnboardingPort {
  /**
   * Garantiza que el usuario tenga al menos un tenant.
   *
   * Idempotente: si ya tiene una membership activa, la devuelve sin crear nada.
   * Atómico: tenant y membership se crean juntos o no se crea ninguno.
   */
  ensureInitialTenant(userId: string, tenantName: string): Promise<OnboardingResult>;
}
