import { useId, useState } from "react";
import { aiProviderInfo, type AiCredentialSummary, type UpdateAiCredentialRequest } from "@contracts/AiContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { SecretInput } from "./SecretInput";

/** Renombrar una conexión o reemplazar su clave (la nueva se verifica antes de guardarla). */
export function EditAiCredentialDialog({
  credential,
  mode,
  onSave,
  onClose
}: {
  readonly credential: AiCredentialSummary;
  readonly mode: "rename" | "key";
  readonly onSave: (request: UpdateAiCredentialRequest) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [value, setValue] = useState(mode === "rename" ? credential.name : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = aiProviderInfo(credential.provider);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(mode === "rename" ? { name: value } : { apiKey: value.trim() });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id={titleId}>{mode === "rename" ? "Renombrar conexión" : `Cambiar la clave de «${credential.name}»`}</h2>
        {mode === "rename" ? (
          <label className="ui-field">
            <span>Nombre</span>
            <input className="ui-input" value={value} maxLength={60} autoFocus onChange={(e) => setValue(e.target.value)} />
          </label>
        ) : (
          <div className="ui-field">
            <label htmlFor={`${titleId}-key`}>Nueva clave de {info.name}</label>
            <SecretInput id={`${titleId}-key`} value={value} placeholder={info.keyPlaceholder} onChange={setValue} />
            <span className="ui-muted">Los bloques que usan esta conexión empiezan a usar la clave nueva al instante.</span>
          </div>
        )}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || (mode === "rename" ? value.trim() === "" : value.trim().length < 20)}>
            {saving ? (mode === "key" ? "Verificando…" : "Guardando…") : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
