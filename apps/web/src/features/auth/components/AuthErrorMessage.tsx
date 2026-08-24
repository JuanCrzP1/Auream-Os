import "../styles/auth-form.css";

/** Presenta un error de autenticación. No decide cuál ni por qué. */
export function AuthErrorMessage({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <p className="auth-form__error" role="alert">
      {message}
    </p>
  );
}
