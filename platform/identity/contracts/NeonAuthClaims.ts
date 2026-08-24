/**
 * Claims que emite Neon Auth (Better Auth) en su JWT.
 *
 * Forma verificada contra un token real del endpoint de Neon Auth. Sólo se
 * declaran los claims que el verificador consume; el token trae además datos
 * de perfil (name, email, emailVerified…) que deliberadamente NO se modelan
 * aquí porque la plataforma no debe depender de ellos para autenticar.
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
}
