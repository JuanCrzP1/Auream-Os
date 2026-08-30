import { Link } from "react-router-dom";
import { useForgotPassword } from "@shared/auth/hooks/useForgotPassword";
import { AuthLayout } from "../components/AuthLayout";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

/**
 * Solicitud de recuperación de contraseña.
 *
 * Tras enviar se muestra siempre la misma confirmación, exista o no la cuenta:
 * decir "ese correo no está registrado" permitiría averiguar qué emails tienen
 * cuenta en la plataforma.
 */
export function ForgotPasswordPage() {
  const { pending, error, sent, request } = useForgotPassword();

  const backToLogin = <Link to="/login">Volver a iniciar sesión</Link>;

  if (sent) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle="Si existe una cuenta con ese correo, recibirás instrucciones para recuperar tu contraseña."
        footer={backToLogin}
      >
        <p className="auth-form__notice" role="status">
          El enlace caduca en una hora. Si no lo encuentras, revisa la carpeta de spam.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace para crear una contraseña nueva."
      footer={backToLogin}
    >
      <ForgotPasswordForm pending={pending} error={error} onSubmit={(e) => void request(e)} />
    </AuthLayout>
  );
}
