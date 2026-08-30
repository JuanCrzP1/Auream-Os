import { MIN_PASSWORD_LENGTH, meetsPasswordPolicy } from "@shared/auth/contracts/passwordPolicy";
import "../styles/auth-form.css";

interface Props {
  readonly password: string;
  readonly confirmation: string;
}

/**
 * Requisitos de la contraseña y si se cumplen.
 *
 * Responsabilidad única: mostrar el estado de cada requisito. La política vive
 * en `passwordPolicy`; aquí sólo se presenta.
 *
 * Se muestra antes de enviar para que el usuario no descubra que su contraseña
 * es inválida por un error del servidor.
 */
export function PasswordRequirements({ password, confirmation }: Props) {
  const longEnough = meetsPasswordPolicy(password);
  const matches = password.length > 0 && password === confirmation;

  return (
    <ul className="auth-form__requirements">
      <li className={longEnough ? "is-met" : undefined}>
        Al menos {MIN_PASSWORD_LENGTH} caracteres
      </li>
      <li className={matches ? "is-met" : undefined}>Ambas contraseñas coinciden</li>
    </ul>
  );
}
