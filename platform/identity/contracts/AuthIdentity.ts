/**
 * AuthIdentity — resultado de verificar una credencial.
 *
 * Hoy el tenant viaja dentro de la identidad: una credencial verificada
 * pertenece a un único tenant y trae sus scopes ya resueltos. Ese modelo es
 * correcto y no cambia en esta fase.
 *
 * Cadena completa una vez exista login real (Fase 1):
 *
 *   User          quién es           platform/identity/contracts/User.ts
 *     ↓
 *   Membership    dónde y con qué rol domains/team/contracts/Membership.ts
 *     ↓
 *   Role          qué significa el rol platform/authorization/contracts/Role.ts
 *     ↓
 *   ROLE_SCOPES   qué permite          platform/authorization/roles/
 *     ↓
 *   AuthIdentity  esto                 (tenantId + scopes ya resueltos)
 *     ↓
 *   Actor         identidad de acceso  platform/authorization/contracts/Actor.ts
 *
 * El token se emite PARA UN TENANT, tras resolver la membership elegida. Por eso
 * `AuthIdentity` no necesita cambiar de forma para soportar usuarios con varios
 * tenants: cambiar de tenant será emitir una identidad nueva.
 *
 * `actorId` es deliberadamente polimórfico: puede ser un usuario, un cliente de
 * API o un worker (ver `Role`). No asumir que siempre es un `User.id`.
 */
export interface AuthIdentity {
  readonly tenantId: string;
  readonly actorId: string;
  readonly scopes: ReadonlyArray<string>;
}
