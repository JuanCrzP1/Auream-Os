import { useId, useState } from "react";
import { META_EVENTS_MANAGER_URL, type CreatePixelConnectionRequest } from "@contracts/PixelContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import "@shared/ui/integration-kit/connect-dialog.css";
import "./pixel.css";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { SecretInput } from "@shared/ui/integration-kit/SecretInput";

/**
 * Conectar un píxel de Meta: nombre, ID del conjunto de datos y token de la
 * API de Conversiones. El servidor comprueba con Meta que el token tenga
 * acceso a ese píxel antes de guardarlo (cifrado).
 */
export function ConnectPixelDialog({
  onConnect,
  onClose
}: {
  readonly onConnect: (request: CreatePixelConnectionRequest) => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanId = pixelId.replace(/\D/g, "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConnect({ name: name.trim() || `Píxel ${cleanId.slice(-4)}`, pixelId: cleanId, accessToken: token.trim() });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo conectar el píxel. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog ai-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <div className="pixel-dialog__head">
          <MetaMark />
          <div>
            <h2 id={titleId}>Conectar un píxel de Meta</h2>
            <p className="ui-muted">El token se comprueba con Meta y se guarda cifrado. Nunca se vuelve a mostrar completo.</p>
          </div>
        </div>

        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={60} placeholder="Píxel de ventas" onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="ui-field">
          <span>ID del píxel (conjunto de datos)</span>
          <input className="ui-input" value={pixelId} inputMode="numeric" placeholder="1234567890123456" onChange={(e) => setPixelId(e.target.value)} />
        </label>

        <div className="ui-field">
          <span className="ai-dialog__label-row">
            <label htmlFor={`${titleId}-token`}>Token de la API de Conversiones</label>
            <a href={META_EVENTS_MANAGER_URL} target="_blank" rel="noopener noreferrer" className="ai-dialog__help">
              ¿Dónde lo consigo?
            </a>
          </span>
          <SecretInput id={`${titleId}-token`} value={token} placeholder="EAAG…" onChange={setToken} />
          <span className="ui-muted">Administrador de eventos → tu píxel → Configuración → API de Conversiones → Generar token de acceso.</span>
        </div>

        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || cleanId.length < 8 || token.trim().length < 30}>
            {saving ? "Verificando con Meta…" : "Conectar"}
          </button>
        </div>
      </form>
    </div>
  );
}
