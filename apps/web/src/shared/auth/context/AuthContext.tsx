import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "../client/authClient";
import { tokenStore } from "../client/tokenStore";
import type { AuthSession, SessionState } from "../contracts/AuthSession";

/**
 * Estado de sesión de la aplicación.
 *
 * Responsabilidad única: saber si hay sesión y mantenerla al día. No renderiza
 * pantallas ni decide rutas; de eso se encarga `ProtectedRoute`.
 *
 * Al montar intenta restaurar la sesión desde la cookie del proveedor, de modo
 * que recargar el navegador no obliga a iniciar sesión otra vez.
 */

interface AuthContextValue {
  readonly state: SessionState;
  readonly refresh: () => Promise<void>;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const user = await authClient.getSession();

      if (!user) {
        tokenStore.clear();
        setState({ status: "anonymous" });
        return;
      }

      tokenStore.setSessionPresent(true);
      const session: AuthSession = { userId: user.id, email: user.email, name: user.name };
      setState({ status: "authenticated", session });
    } catch {
      // Un fallo al consultar la sesión se trata como "no autenticado": nunca
      // deja al usuario dentro de la aplicación sin sesión verificada.
      tokenStore.clear();
      setState({ status: "anonymous" });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      tokenStore.clear();
      setState({ status: "anonymous" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ state, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return value;
}
