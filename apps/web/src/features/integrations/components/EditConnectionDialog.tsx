import { useId, useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { SecretInput } from "./SecretInput";

/**
 * Renombrar una conexión o reemplazar su secreto (clave de IA, token de
 * píxel). El servidor verifica el secreto nuevo antes de guardarlo. Común a
 * todas las conexiones de Integraciones.
 */
export function EditConnectionDialog({
  name,
  mode,
  secretLabel,
  secretFieldLabel,
  secretPlaceholder,
  secretHint,
  minSecretLength = 20,
  onSave,
  onClose
}: {
  readonly name: string;
  readonly mode: "rename" | "secret";
  /** Qué se cambia, para el título: «clave», «token». */
  readonly secretLabel: string;
  /** Rótulo del campo: «Nueva clave de OpenAI», «Nuevo token». */
  readonly secretFieldLabel: string;
  readonly secretPlaceholder: string;
  readonly secretHint: string;
  readonly minSecretLength?: number;
  readonly onSave: (value: string) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [value, setValue] = useState(mode === "rename" ? name : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(value.trim());
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  const ready = mode === "rename" ? value.trim() !== "" : value.trim().length >= minSecretLength;

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id={titleId}>{mode === "rename" ? "Renombrar conexión" : `Cambiar ${secretLabel} de «${name}»`}</h2>
        {mode === "rename" ? (
          <label className="ui-field">
            <span>Nombre</span>
            <input className="ui-input" value={value} maxLength={60} autoFocus onChange={(e) => setValue(e.target.value)} />
          </label>
        ) : (
          <div className="ui-field">
            <label htmlFor={`${titleId}-secret`}>{secretFieldLabel}</label>
            <SecretInput id={`${titleId}-secret`} value={value} placeholder={secretPlaceholder} onChange={setValue} />
            <span className="ui-muted">{secretHint}</span>
          </div>
        )}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || !ready}>
            {saving ? (mode === "secret" ? "Verificando…" : "Guardando…") : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
