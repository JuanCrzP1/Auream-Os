import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/auth/context/AuthContext";
import { useAuthActions } from "@shared/auth/hooks/useAuthActions";
import { AuthLayout } from "@shared/ui/auth-layout/AuthLayout";
import { RegisterForm } from "../components/RegisterForm";

/**
 * Pantalla de registro.
 *
 * El espacio de trabajo inicial no se crea aquí: lo garantiza el servidor de
 * forma idempotente cuando la aplicación carga (`/me/onboarding`), para que un
 * fallo de red no deje al usuario sin tenant ni cree duplicados al recargar.
 */
export function RegisterPage() {
  const { state } = useAuth();
  const { pending, error, signUp } = useAuthActions();
  const location = useLocation();
  // Desde una invitación al equipo: al crear la cuenta se vuelve a ella (y el enlace a «Entrar» la conserva).
  const from = (location.state as { from?: string } | null)?.from;

  if (state.status === "authenticated") {
    return <Navigate to={from ?? "/automations"} replace />;
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle={from ? "Crea tu cuenta con el correo que invitaron y luego te unes al equipo." : "Tu espacio de trabajo se prepara automáticamente."}
      footer={
        <>
          <span>¿Ya tienes cuenta? </span>
          <Link to="/login" state={from ? { from } : undefined}>
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm pending={pending} error={error} onSubmit={(e, p, n) => void signUp(e, p, n)} />
    </AuthLayout>
  );
}
