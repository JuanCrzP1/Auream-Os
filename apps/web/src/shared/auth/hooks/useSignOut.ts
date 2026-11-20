import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { activeTenantStore } from "../tenant/activeTenantStore";
import { disableOnThisDevice } from "@shared/notifications/devicePush";

/**
 * Cerrar sesión: quita los avisos de este dispositivo (que quien entre después
 * no reciba los tuyos), invalida la sesión en el proveedor, limpia el estado
 * local (incluido el tenant activo) y vuelve al login. Lo usan el botón de
 * cerrar sesión y el menú de la cuenta.
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return useCallback(async () => {
    // Con la sesión todavía abierta; si falla, igual se cierra sesión.
    await disableOnThisDevice().catch(() => undefined);
    await signOut();
    activeTenantStore.clear();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);
}
