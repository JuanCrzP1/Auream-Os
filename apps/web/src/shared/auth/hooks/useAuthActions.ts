import { useCallback, useState } from "react";
import { authClient } from "../client/authClient";
import { AuthRequestError } from "../client/authFetch";
import { useAuth } from "../context/AuthContext";

/**
 * Acciones de autenticación con su estado de carga y error.
 *
 * Responsabilidad única: ejecutar login/registro y exponer cómo va. No
 * renderiza nada ni decide navegación.
 */

function messageFor(error: unknown): string {
  if (error instanceof AuthRequestError) {
    return error.status === 401 || error.status === 400
      ? "Credenciales incorrectas."
      : error.message;
  }

  return "No se pudo conectar con el servicio de autenticación.";
}

export interface AuthActionsState {
  readonly pending: boolean;
  readonly error: string | null;
  readonly signIn: (email: string, password: string) => Promise<boolean>;
  readonly signUp: (email: string, password: string, name: string) => Promise<boolean>;
}

export function useAuthActions(): AuthActionsState {
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setPending(true);
      setError(null);

      try {
        await action();
        await refresh();
        return true;
      } catch (caught) {
        setError(messageFor(caught));
        return false;
      } finally {
        setPending(false);
      }
    },
    [refresh]
  );

  return {
    pending,
    error,
    signIn: (email, password) => run(() => authClient.signInWithEmail(email, password)),
    signUp: (email, password, name) => run(() => authClient.signUpWithEmail(email, password, name))
  };
}
