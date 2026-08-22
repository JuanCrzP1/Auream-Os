/**
 * User — quién es la persona.
 *
 * Es identidad de plataforma, no de tenant: un mismo usuario puede pertenecer
 * a varios tenants con roles distintos.
 *
 * NO contiene rol, permisos, scopes, facturación ni propiedad de recursos.
 * Todo eso es contextual a un tenant y vive en `Membership`
 * (`domains/team/contracts/Membership.ts`).
 *
 * Estado: PREPARADO. Modelo conceptual sin persistencia ni emisión de tokens.
 */

export type UserStatus = "active" | "suspended";

export interface User {
  readonly id: string;
  /** Handle de login. Único en toda la plataforma, no por tenant. */
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
}
