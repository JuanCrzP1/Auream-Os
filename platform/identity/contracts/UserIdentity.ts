/**
 * UserIdentity — quién es el usuario autenticado. Nada más.
 *
 * Es lo ÚNICO que un JWT de Neon Auth puede afirmar honestamente: el token
 * identifica a una persona, no dice a qué tenant pertenece ni qué puede hacer.
 *
 * Deliberadamente NO contiene:
 *   tenantId · role · scopes · permissions
 *
 * Esos datos se resuelven en servidor desde `memberships` (ver
 * `apps/api/middleware/resolveRequestContext.ts`). Un token no puede
 * falsificarlos porque el verificador nunca los lee.
 *
 * La identidad NO es autorización.
 */
export interface UserIdentity {
  /** `sub` del JWT — el id del usuario en Neon Auth. */
  readonly actorId: string;
}
