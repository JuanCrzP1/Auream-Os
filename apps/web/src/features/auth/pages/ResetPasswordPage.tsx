import { Link, useSearchParams } from "react-router-dom";
import { useResetPassword } from "@shared/auth/hooks/useResetPassword";
import { AuthLayout } from "../components/AuthLayout";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

/**
 * Establecimiento de la nueva contraseña.
 *
 * El token llega en la query porque es el proveedor quien redirige aquí desde
 * el correo. Si el enlace ya venía caducado, el proveedor añade `?error=`; en
 * ese caso ni siquiera se muestra el formulario.
 *
 * Al terminar no se inicia sesión automáticamente: el usuario vuelve a
 * `/login` y entra con la contraseña nueva, que es el estado sin ambigüedad.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const { pending, error, done, submit } = useResetPassword();

  const token = params.get("token");
  const linkError = params.get("error");

  const backToLogin = <Link to="/login">Volver a iniciar sesión</Link>;

  if (done) {
    return (
      <AuthLayout
        title="Contraseña actualizada"
        subtitle="Ya puedes entrar con tu nueva contraseña."
        footer={backToLogin}
      >
        <p className="auth-form__notice" role="status">
          Por seguridad, la contraseña anterior ha dejado de funcionar.
        </p>
      </AuthLayout>
    );
  }

  if (!token || linkError) {
    return (
      <AuthLayout
        title="Enlace no válido"
        subtitle="Este enlace de recuperación no es válido o ha caducado."
        footer={backToLogin}
      >
        <p className="auth-form__notice" role="alert">
          Solicita uno nuevo desde <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nueva contraseña"
      subtitle="Elige una contraseña que no uses en otros servicios."
      footer={backToLogin}
    >
      <ResetPasswordForm
        pending={pending}
        error={error}
        onSubmit={(password) => void submit(token, password)}
      />
    </AuthLayout>
  );
}
