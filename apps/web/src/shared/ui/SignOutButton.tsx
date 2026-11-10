import { useSignOut } from "../auth/hooks/useSignOut";
import "./sign-out-button.css";

/**
 * Cierre de sesión.
 *
 * Invalida la sesión en el proveedor, limpia el estado local (incluido el
 * tenant activo) y devuelve al login (`useSignOut`).
 */
export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <button type="button" className="sign-out-button" onClick={() => void signOut()}>
      Cerrar sesión
    </button>
  );
}
