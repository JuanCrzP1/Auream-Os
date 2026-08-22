/**
 * Tenant — la organización cliente.
 *
 * Es la unidad de aislamiento de datos de toda la plataforma: cada entidad de
 * negocio pertenece a un tenant y los puertos de repositorio exigen `tenantId`.
 *
 * NO contiene usuarios ni roles: la pertenencia es `Membership`
 * (`domains/team/contracts/Membership.ts`).
 *
 * Distinto de `TenantContext` (`contracts/RuntimeContracts.ts`), que es lo que
 * el motor necesita en ejecución —identificador y límites—, no la entidad.
 *
 * Estado: PREPARADO. Modelo conceptual sin persistencia.
 */

export type TenantStatus = "active" | "suspended";

export interface Tenant {
  readonly id: string;
  /** Identificador legible y estable, usado en URLs y logs. */
  readonly key: string;
  readonly name: string;
  readonly status: TenantStatus;
}
