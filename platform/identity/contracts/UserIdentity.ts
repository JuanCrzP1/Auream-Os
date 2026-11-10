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
  /**
   * Correo de acceso, tal como lo firmó Neon Auth (en minúsculas). Es un DATO
   * de la persona, no un permiso: sirve para casar una invitación del equipo
   * con quien la acepta y para mostrar a cada miembro. Nunca autoriza nada
   * por sí solo. Ausente si el token no lo trae.
   */
  readonly email?: string;
  /** Si Neon Auth confirmó ese correo. */
  readonly emailVerified?: boolean;
  /** Nombre con el que se registró (dato de la persona, para mostrarla a su equipo). */
  readonly name?: string;
}
