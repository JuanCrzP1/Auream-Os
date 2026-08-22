import type { Role } from "../../../platform/authorization/contracts/Role";

/**
 * Membership — la pertenencia de un usuario a un tenant con un rol.
 *
 * Es la pieza que faltaba en la cadena de identidad:
 *
 *   USER → MEMBERSHIP → TENANT → ROLE → SCOPES → RESOURCE
 *
 * Un usuario puede tener varias memberships:
 *
 *   User A ├── Tenant A → tenant_owner
 *          └── Tenant B → operator
 *
 * Reparto de responsabilidades:
 *   `platform/authorization` define QUÉ significa cada rol y qué scopes otorga.
 *   `domains/team` (aquí) define QUIÉN tiene cuál rol en qué tenant.
 *
 * Esa separación es deliberada: la política de acceso es transversal, la
 * pertenencia es negocio del equipo.
 *
 * Estado: PREPARADO. Modelo conceptual sin persistencia, sin puerto de
 * repositorio y sin caso de uso. Fase 1 los añadirá.
 */

export type MembershipStatus = "invited" | "active" | "revoked";

export interface Membership {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly status: MembershipStatus;
}
