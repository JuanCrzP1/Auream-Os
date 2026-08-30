import { useCallback, useState } from "react";
import { authClient } from "../client/authClient";
import { authErrorMessage } from "../errors/authErrorMessage";
import { useAuth } from "../context/AuthContext";

/**
 * Acciones de autenticación con su estado de carga y error.
 *
 * Responsabilidad única: ejecutar login/registro y exponer cómo va. No
 * renderiza nada, no decide navegación y no traduce errores: de eso se encarga
 * `authErrorMessage`.
 */

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
      // Un segundo envío mientras el primero sigue en vuelo se ignora: evita
      // registrar dos veces o encadenar dos intentos de login con un doble clic.
      if (pending) {
        return false;
      }

      setPending(true);
      setError(null);

      try {
        await action();
        await refresh();
        return true;
      } catch (caught) {
        setError(authErrorMessage(caught));
        return false;
      } finally {
        setPending(false);
      }
    },
    [pending, refresh]
  );

  return {
    pending,
    error,
    signIn: (email, password) => run(() => authClient.signInWithEmail(email, password)),
    signUp: (email, password, name) => run(() => authClient.signUpWithEmail(email, password, name))
  };
}
