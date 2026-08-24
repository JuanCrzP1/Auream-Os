import type { UserIdentity } from "../contracts/UserIdentity";

/**
 * Verificador de tokens de portador.
 *
 * Devuelve únicamente la identidad del usuario: un token nunca es fuente de
 * autoridad sobre tenant ni permisos.
 */
export interface TokenVerifier {
  verify(token: string): Promise<UserIdentity>;
}
