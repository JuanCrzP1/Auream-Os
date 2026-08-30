import { useCallback, useState } from "react";
import { passwordClient } from "../client/passwordClient";
import { authErrorMessage } from "../errors/authErrorMessage";

/**
 * Establecimiento de la nueva contraseña con el token del correo.
 *
 * Responsabilidad única: ejecutar el cambio y exponer su estado. No lee la URL
 * (el token se lo pasa la página) ni decide navegación.
 *
 * Tras un cambio correcto NO se inicia sesión automáticamente: el proveedor
 * invalida la contraseña anterior y el usuario vuelve a `/login` con la nueva.
 * Es lo que evita quedarse con una sesión en un estado ambiguo.
 */

export interface ResetPasswordState {
  readonly pending: boolean;
  readonly error: string | null;
  readonly done: boolean;
  readonly submit: (token: string, newPassword: string) => Promise<void>;
}

export function useResetPassword(): ResetPasswordState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(
    async (token: string, newPassword: string) => {
      if (pending) {
        return;
      }

      setPending(true);
      setError(null);

      try {
        await passwordClient.reset(token, newPassword);
        setDone(true);
      } catch (caught) {
        setError(authErrorMessage(caught));
      } finally {
        setPending(false);
      }
    },
    [pending]
  );

  return { pending, error, done, submit };
}
