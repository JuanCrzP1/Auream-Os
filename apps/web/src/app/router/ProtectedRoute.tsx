import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/auth/context/AuthContext";

/**
 * Única estrategia de protección de rutas privadas.
 *
 * Mientras se restaura la sesión no renderiza la aplicación: evita el parpadeo
 * de mostrar contenido y expulsar al usuario un instante después.
 *
 * La protección real está en el servidor: esto sólo evita renderizar una
 * interfaz que la API rechazaría de todos modos.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading") {
    return <div className="app-state">Comprobando sesión...</div>;
  }

  if (state.status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
