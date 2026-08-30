import { useState, type FormEvent } from "react";
import { meetsPasswordPolicy } from "@shared/auth/contracts/passwordPolicy";
import { AuthErrorMessage } from "./AuthErrorMessage";
import { AuthSubmitButton } from "./AuthSubmitButton";
import { PasswordField } from "./PasswordField";
import { PasswordRequirements } from "./PasswordRequirements";
import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly error: string | null;
  readonly onSubmit: (email: string, password: string, name: string) => void;
}

/**
 * Campos y envío del registro.
 *
 * La confirmación de contraseña no es decorativa: sin ella, un error de tecleo
 * crea la cuenta con una contraseña que el usuario no conoce, y el siguiente
 * inicio de sesión falla sin explicación posible.
 */
export function RegisterForm({ pending, error, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const valid = meetsPasswordPolicy(password) && password === confirmation;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!valid) {
      return;
    }

    onSubmit(email, password, name);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
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

      <PasswordField
        label="Contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirmar contraseña"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />

      <PasswordRequirements password={password} confirmation={confirmation} />

      <AuthErrorMessage message={error} />
      <AuthSubmitButton
        pending={pending}
        disabled={!valid}
        idleLabel="Crear cuenta"
        pendingLabel="Creando..."
      />
    </form>
  );
}
