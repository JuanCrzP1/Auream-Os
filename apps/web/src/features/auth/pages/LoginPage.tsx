import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@shared/auth/context/AuthContext";
import { useAuthActions } from "@shared/auth/hooks/useAuthActions";
import { AuthLayout } from "../components/AuthLayout";
import { LoginForm } from "../components/LoginForm";

/** Pantalla de inicio de sesión. Sólo compone: la lógica vive en los hooks. */
export function LoginPage() {
  const { state } = useAuth();
  const { pending, error, signIn } = useAuthActions();
  const location = useLocation();

  if (state.status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from ?? "/automations";
    return <Navigate to={from} replace />;
  }

  return (
    <AuthLayout
      title="Bots AI Platform"
      subtitle="Entra para gestionar tus automatizaciones."
      footer={
        <>
          <span>¿No tienes cuenta? </span>
          <Link to="/register">Crear una</Link>
        </>
      }
    >
      <LoginForm pending={pending} error={error} onSubmit={(e, p) => void signIn(e, p)} />
    </AuthLayout>
  );
}
