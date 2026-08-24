import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/context/AuthContext";
import { activeTenantStore } from "../auth/tenant/activeTenantStore";
import "./sign-out-button.css";

/**
 * Cierre de sesión.
 *
 * Invalida la sesión en el proveedor, limpia el estado local (incluido el
 * tenant activo) y devuelve al login.
 */
export function SignOutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleClick = async () => {
    await signOut();
    activeTenantStore.clear();
    navigate("/login", { replace: true });
  };

  return (
    <button type="button" className="sign-out-button" onClick={() => void handleClick()}>
      Cerrar sesión
    </button>
  );
}
