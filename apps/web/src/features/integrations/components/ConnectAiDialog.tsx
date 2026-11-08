import { useId, useState } from "react";
import { AI_PROVIDERS, aiProviderInfo, type AiProviderId, type CreateAiCredentialRequest } from "@contracts/AiContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { ProviderMark } from "./ProviderMark";
import { SecretInput } from "./SecretInput";

/**
 * Conectar una cuenta de IA: proveedor, nombre y clave. Al enviar, el servidor
 * comprueba la clave con el proveedor antes de guardarla (cifrada).
 */
export function ConnectAiDialog({
  onConnect,
  onClose
}: {
  readonly onConnect: (request: CreateAiCredentialRequest) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [provider, setProvider] = useState<AiProviderId>("openai");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const info = aiProviderInfo(provider);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConnect({ provider, name: name.trim() || info.name, apiKey: apiKey.trim() });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo conectar. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog ai-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id={titleId}>Conectar una IA</h2>
        <p className="ui-muted">La clave se comprueba con el proveedor y se guarda cifrada. Nunca se vuelve a mostrar completa.</p>

        <div className="ai-providers" role="radiogroup" aria-label="Proveedor">
          {AI_PROVIDERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={provider === option.id}
              className={`ai-provider${provider === option.id ? " ai-provider--on" : ""}`}
              onClick={() => setProvider(option.id)}
            >
              <ProviderMark provider={option.id} size="sm" />
              <span>{option.name}</span>
            </button>
          ))}
        </div>

        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={60} placeholder={`${info.name} principal`} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="ui-field">
          <span className="ai-dialog__label-row">
            <label htmlFor={`${titleId}-key`}>Clave de API</label>
            <a href={info.keysUrl} target="_blank" rel="noopener noreferrer" className="ai-dialog__help">
              ¿Dónde la consigo?
            </a>
          </span>
          <SecretInput id={`${titleId}-key`} value={apiKey} placeholder={info.keyPlaceholder} onChange={setApiKey} />
        </div>

        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || apiKey.trim().length < 20}>
            {saving ? `Verificando con ${info.name}…` : "Conectar"}
          </button>
        </div>
      </form>
    </div>
  );
}
