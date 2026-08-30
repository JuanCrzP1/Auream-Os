import { useState, type FormEvent } from "react";
import { AuthErrorMessage } from "./AuthErrorMessage";
import { AuthSubmitButton } from "./AuthSubmitButton";
import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly error: string | null;
  readonly onSubmit: (email: string) => void;
}

/** Campo y envío de la solicitud de recuperación. */
export function ForgotPasswordForm({ pending, error, onSubmit }: Props) {
  const [email, setEmail] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="auth-form__field">
        <span>Correo electrónico</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <AuthErrorMessage message={error} />
      <AuthSubmitButton pending={pending} idleLabel="Enviar enlace" pendingLabel="Enviando..." />
    </form>
  );
}
