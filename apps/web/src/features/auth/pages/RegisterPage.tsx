import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@shared/auth/context/AuthContext";
import { useAuthActions } from "@shared/auth/hooks/useAuthActions";
import { AuthLayout } from "../components/AuthLayout";
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

  if (state.status === "authenticated") {
    return <Navigate to="/automations" replace />;
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Tu espacio de trabajo se prepara automáticamente."
      footer={
        <>
          <span>¿Ya tienes cuenta? </span>
          <Link to="/login">Entrar</Link>
        </>
      }
    >
      <RegisterForm pending={pending} error={error} onSubmit={(e, p, n) => void signUp(e, p, n)} />
    </AuthLayout>
  );
}
