import { useState, type FormEvent } from "react";
import { passwordClient } from "@shared/auth/client/passwordClient";
import { authErrorMessage } from "@shared/auth/errors/authErrorMessage";
import { MIN_PASSWORD_LENGTH, meetsPasswordPolicy } from "@shared/auth/contracts/passwordPolicy";

/**
 * Cambiar la contraseña. Pide la actual (la verifica el proveedor) y, al
 * cambiarla, cierra tu sesión en los demás equipos.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ readonly kind: "ok" | "error"; readonly text: string } | null>(null);

  const problem = !next
    ? null
    : !meetsPasswordPolicy(next)
      ? `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      : repeat && repeat !== next
        ? "Las contraseñas nuevas no coinciden."
        : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem || repeat !== next) return;
    setSaving(true);
    setMessage(null);
    try {
      await passwordClient.change(current, next);
      setMessage({ kind: "ok", text: "Contraseña cambiada. Cerramos tu sesión en los demás equipos." });
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (e) {
      setMessage({ kind: "error", text: authErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="account-section" onSubmit={(event) => void submit(event)}>
      <div className="account-section__head">
        <h2 className="account-section__title">Contraseña</h2>
        <p className="account-section__subtitle">Usa al menos {MIN_PASSWORD_LENGTH} caracteres. Al cambiarla se cierra tu sesión en los demás equipos.</p>
      </div>
      <div className="account-section__grid">
        <label className="ui-field">
          <span>Contraseña actual</span>
          <input className="ui-input" type="password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} />
        </label>
        <span aria-hidden="true" />
        <label className="ui-field">
          <span>Nueva contraseña</span>
          <input className="ui-input" type="password" autoComplete="new-password" required value={next} onChange={(event) => setNext(event.target.value)} />
        </label>
        <label className="ui-field">
          <span>Repite la nueva contraseña</span>
          <input className="ui-input" type="password" autoComplete="new-password" required value={repeat} onChange={(event) => setRepeat(event.target.value)} />
        </label>
      </div>
      <div className="account-section__footer">
        {problem ? <span className="ui-error" role="alert">{problem}</span> : null}
        {!problem && message ? (
          <span className={message.kind === "ok" ? "account-section__ok" : "ui-error"} role={message.kind === "ok" ? "status" : "alert"}>
            {message.text}
          </span>
        ) : null}
        <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || Boolean(problem) || !current || !next || repeat !== next}>
          {saving ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}
