/**
 * AuthIdentity — resultado de verificar una credencial de MÁQUINA (API key).
 *
 * A diferencia de un usuario humano (ver `UserIdentity`), una API key ya se
 * emite para un tenant concreto y con unos scopes fijos de origen: no hay
 * membership que resolver, porque no hay persona detrás eligiendo tenant.
 *
 *   ApiKeyVerifier → AuthIdentity (tenantId + scopes ya resueltos) → Actor
 *
 * `actorId` es deliberadamente polimórfico: puede ser un cliente de API o un
 * worker (ver `Role`). Para un usuario humano, ver `UserIdentity` y
 * `apps/api/middleware/resolveRequestContext.ts`, que resuelve tenant y scopes
 * contra `memberships` en vez de traerlos ya asignados.
 */
export interface AuthIdentity {
  readonly tenantId: string;
  readonly actorId: string;
  readonly scopes: ReadonlyArray<string>;
}
