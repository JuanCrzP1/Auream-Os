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
  readonly onSubmit: (newPassword: string) => void;
}

/** Campos y envío de la nueva contraseña. No conoce el token. */
export function ResetPasswordForm({ pending, error, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const valid = meetsPasswordPolicy(password) && password === confirmation;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!valid) {
      return;
    }

    onSubmit(password);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <PasswordField
        label="Nueva contraseña"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />

      <PasswordField
        label="Confirmar nueva contraseña"
        value={confirmation}
        onChange={setConfirmation}
        autoComplete="new-password"
      />

      <PasswordRequirements password={password} confirmation={confirmation} />

      <AuthErrorMessage message={error} />
      <AuthSubmitButton
        pending={pending}
        disabled={!valid}
        idleLabel="Cambiar contraseña"
        pendingLabel="Cambiando..."
      />
    </form>
  );
}
