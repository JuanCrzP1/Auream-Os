import "../styles/auth-form.css";

interface Props {
  readonly pending: boolean;
  readonly idleLabel: string;
  readonly pendingLabel: string;
}

/** Botón de envío con estado de carga. Sin lógica de red. */
export function AuthSubmitButton({ pending, idleLabel, pendingLabel }: Props) {
  return (
    <button type="submit" className="auth-form__submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
