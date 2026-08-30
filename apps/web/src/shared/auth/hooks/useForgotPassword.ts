import { useCallback, useState } from "react";
import { passwordClient } from "../client/passwordClient";
import { authErrorMessage } from "../errors/authErrorMessage";

/**
 * Solicitud del correo de recuperación.
 *
 * Responsabilidad única: pedir el envío y exponer en qué estado va. No
 * renderiza nada ni decide navegación.
 *
 * `sent` se pone a true cuando el proveedor acepta la solicitud, exista o no
 * la cuenta. La pantalla muestra siempre el mismo mensaje: revelar si el email
 * está registrado permitiría enumerar usuarios.
 */

/** Pantalla a la que el proveedor devuelve al usuario con el token. */
function resetRedirectUrl(): string {
  return `${window.location.origin}/reset-password`;
}

export interface ForgotPasswordState {
  readonly pending: boolean;
  readonly error: string | null;
  readonly sent: boolean;
  readonly request: (email: string) => Promise<void>;
}

export function useForgotPassword(): ForgotPasswordState {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const request = useCallback(
    async (email: string) => {
      if (pending) {
        return;
      }

      setPending(true);
      setError(null);

      try {
        await passwordClient.requestReset(email, resetRedirectUrl());
        setSent(true);
      } catch (caught) {
        setError(authErrorMessage(caught));
      } finally {
        setPending(false);
      }
    },
    [pending]
  );

  return { pending, error, sent, request };
}
