/**
 * Claims que emite Neon Auth (Better Auth) en su JWT.
 *
 * Forma verificada contra un token real del endpoint de Neon Auth. Se declaran
 * los claims que el verificador consume para autenticar, más el correo, su
 * verificación y el nombre como DATOS de la persona (invitaciones y lista del
 * equipo), que nunca intervienen en autenticar ni en autorizar. El resto del
 * perfil (image…) no se modela: la plataforma no depende de él.
 *
 * ATENCIÓN — el token incluye un claim `role` con valor "authenticated".
 * Ese NO es nuestro `Role` (`platform/authorization/contracts/Role.ts`).
 * Es vocabulario interno de Better Auth y jamás debe usarse para autorizar.
 */
export interface NeonAuthClaims {
  /** Identificador del usuario. Se convierte en `UserIdentity.actorId`. */
  readonly sub: string;
  /** Emisor — el endpoint de la rama Neon que firmó el token. */
  readonly iss: string;
  /** Audiencia — el mismo endpoint. */
  readonly aud: string;
  /** Expiración, en segundos Unix. */
  readonly exp: number;
  /** Emitido en, en segundos Unix. */
  readonly iat: number;
  /**
   * Correo de acceso. Dato de perfil: NO interviene en la autenticación (que
   * es sub + firma + iss/aud/exp); solo se expone en `UserIdentity.email`.
   */
  readonly email?: unknown;
  /** Si el correo está confirmado. Mismo tratamiento que `email`. */
  readonly emailVerified?: unknown;
  /** Nombre con el que se registró. Mismo tratamiento que `email`. */
  readonly name?: unknown;
}
