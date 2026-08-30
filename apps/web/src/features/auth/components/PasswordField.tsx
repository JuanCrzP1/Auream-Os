import { useId, useState } from "react";
import "../styles/auth-form.css";

interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** `new-password` en registro y reset; `current-password` en login. */
  readonly autoComplete: "current-password" | "new-password";
}

/**
 * Campo de contraseña con alternancia de visibilidad.
 *
 * Responsabilidad única: presentar el campo. No valida ni envía nada.
 */
export function PasswordField({ label, value, onChange, autoComplete }: Props) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  return (
    <div className="auth-form__field">
      <label htmlFor={inputId}>
        <span>{label}</span>
      </label>

      <div className="auth-form__password">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="auth-form__reveal"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </div>
  );
}
