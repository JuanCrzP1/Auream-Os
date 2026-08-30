import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthErrorMessage } from "./AuthErrorMessage";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { PasswordField } from "./PasswordField";
import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly error: string | null;
  readonly onSubmit: (email: string, password: string) => void;
}

/** Campos y envío del inicio de sesión. No sabe qué proveedor hay detrás. */
export function LoginForm({ pending, error, onSubmit }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email, password);
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

      <PasswordField
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <Link className="auth-form__link" to="/forgot-password">
        ¿Olvidaste tu contraseña?
      </Link>

      <AuthErrorMessage message={error} />
      <AuthSubmitButton pending={pending} idleLabel="Entrar" pendingLabel="Entrando..." />
    </form>
  );
}
