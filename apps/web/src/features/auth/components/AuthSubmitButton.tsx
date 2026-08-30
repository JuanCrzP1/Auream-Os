import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly idleLabel: string;
  readonly pendingLabel: string;
  /** Bloquea el envío por reglas del formulario (por ejemplo, contraseñas que
   *  no coinciden). Independiente de `pending`, que es estado de red. */
  readonly disabled?: boolean;
}

/** Botón de envío con estado de carga. Sin lógica de red. */
export function AuthSubmitButton({ pending, idleLabel, pendingLabel, disabled = false }: Props) {
  return (
    <button
      type="submit"
      className="auth-form__submit"
      disabled={pending || disabled}
      // Distingue "en curso" de "bloqueado por el formulario": ambos están
      // deshabilitados, pero se presentan distinto y se anuncian distinto.
      aria-busy={pending}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
