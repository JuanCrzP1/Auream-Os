import { useState, type FormEvent } from "react";
import { AuthErrorMessage } from "./AuthErrorMessage";
import { AuthSubmitButton } from "./AuthSubmitButton";
import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly error: string | null;
  readonly onSubmit: (email: string, password: string, name: string) => void;
}

/** Campos y envío del registro. */
export function RegisterForm({ pending, error, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(email, password, name);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="auth-form__field">
        <span>Nombre</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </label>

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

      <label className="auth-form__field">
        <span>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>

      <AuthErrorMessage message={error} />
      <AuthSubmitButton pending={pending} idleLabel="Crear cuenta" pendingLabel="Creando..." />
    </form>
  );
}
