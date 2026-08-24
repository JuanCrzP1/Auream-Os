import type { AuthIdentity } from "./AuthIdentity";
import type { UserIdentity } from "./UserIdentity";

/**
 * Quién presentó credenciales válidas, y de qué clase.
 *
 * La distinción importa porque cada clase completa el contexto de forma
 * distinta: un usuario necesita que el servidor resuelva su tenant y sus
 * scopes; una clave de máquina ya los trae asignados de origen.
 */
export type AuthenticatedPrincipal =
  | { readonly kind: "user"; readonly identity: UserIdentity }
  | { readonly kind: "machine"; readonly identity: AuthIdentity };
