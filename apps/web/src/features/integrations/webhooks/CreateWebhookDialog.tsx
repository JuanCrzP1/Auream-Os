import { useId, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { CreateWebhookRequest, WebhookDetail } from "@contracts/WebhookContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/**
 * Crear un webhook (como en Leona): nombre y, si iniciará flujos, el número
 * de WhatsApp por el que salen. Después se configura el mapeo en su página.
 */
export function CreateWebhookDialog({
  connections,
  onCreate,
  onCreated,
  onClose
}: {
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly onCreate: (request: CreateWebhookRequest) => Promise<WebhookDetail>;
  readonly onCreated: (webhook: WebhookDetail) => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onCreated(await onCreate({ name: name.trim(), connectionId: connectionId || null }));
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear el webhook. Inténtalo de nuevo."));
      setSaving(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={saving ? undefined : onClose}>
      <form className="ui-dialog" onClick={(e) => e.stopPropagation()} onSubmit={(e) => void submit(e)}>
        <h2 id={titleId}>Nuevo webhook</h2>
        <p className="ui-muted">Te damos una dirección secreta para pegar en n8n, Make, Hotmart o tu formulario. Después eliges qué hacer con lo que llega.</p>
        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={60} placeholder="Ej.: Ventas Hotmart" autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ui-field">
          <span>Número de WhatsApp (opcional)</span>
          <select className="ui-input" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">Ninguno</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <small className="ui-muted">Solo hace falta para iniciar un flujo: es el número por el que sale. Los datos y etiquetas del contacto se guardan igual.</small>
        </label>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn--primary" disabled={saving || name.trim().length === 0}>
            {saving ? "Creando…" : "Crear y configurar"}
          </button>
        </div>
      </form>
    </div>
  );
}
