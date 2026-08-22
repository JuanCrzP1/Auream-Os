import { createContext, useContext, type ReactNode } from "react";
import type { AuthSession } from "../contracts/AuthSession";

/**
 * Sesión de desarrollo local.
 *
 * Se usa como valor por defecto del contexto (sin provider) y como
 * único valor real hasta que se implemente el login real.
 *
 * TODO (producción): reemplazar por resolución real desde JWT / OAuth.
 */
const LOCAL_DEV_SESSION: AuthSession = {
  tenantId: "test-tenant",
  userId: "dev-user",
  token: null
};

const AuthContext = createContext<AuthSession>(LOCAL_DEV_SESSION);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — proveedor de la sesión autenticada.
 *
 * Envuelve la aplicación y expone la sesión a través de useAuthSession.
 * Actualmente sirve la sesión de desarrollo local. En producción se reemplaza el valor
 * de `session` por la resolución real (JWT decode, cookie, API call).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // TODO: resolver sesión real desde cookie / token / OAuth
  const session: AuthSession = LOCAL_DEV_SESSION;

  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

/**
 * useAuthSession — accede a la sesión del usuario autenticado.
 *
 * NUNCA hardcodear tenantId en componentes. Siempre usar este hook.
 */
export function useAuthSession(): AuthSession {
  return useContext(AuthContext);
}
