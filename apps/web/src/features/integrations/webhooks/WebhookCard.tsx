import "@shared/ui/integration-kit/integration-card.css";
import { Link } from "react-router-dom";
import type { WebhookSummary } from "@contracts/WebhookContracts";
import { formatDateTime } from "@shared/format/formatDate";
import { IntegrationMark } from "@shared/ui/integration-kit/IntegrationMark";

/** Un webhook en la lista: estado, número, lo recibido en el mes y su último envío. */
export function WebhookCard({ webhook, connectionName, onDelete }: { readonly webhook: WebhookSummary; readonly connectionName: string | null; readonly onDelete: () => void }) {
  return (
    <article className="ai-card" aria-label={webhook.name}>
      <header className="ai-card__head">
        <IntegrationMark kind="webhook" />
        <div className="ai-card__title">
          <h3>{webhook.name}</h3>
          <p>{connectionName ? `Número: ${connectionName}` : "Sin número de WhatsApp"}</p>
        </div>
        <span className={`ai-card__status ai-card__status--${webhook.enabled ? "ok" : "ko"}`}>
          <span className="ai-card__status-dot" aria-hidden="true" />
          {webhook.enabled ? "Activo" : "Pausado"}
        </span>
      </header>
      <dl className="ai-card__facts">
        <div>
          <dt>Este mes</dt>
          <dd>{webhook.receivedThisMonth === 1 ? "1 envío" : `${webhook.receivedThisMonth} envíos`}</dd>
        </div>
        <div>
          <dt>Último envío</dt>
          <dd>{webhook.lastReceivedAt ? formatDateTime(webhook.lastReceivedAt) : "Ninguno"}</dd>
        </div>
      </dl>
      <footer className="ai-card__actions">
        <Link className="ui-btn ui-btn--ghost" to={`/integrations/webhooks/${webhook.id}`}>
          Configurar
        </Link>
        <button type="button" className="ai-card__icon-btn ai-card__icon-btn--danger" onClick={onDelete} aria-label={`Eliminar ${webhook.name}`} title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </footer>
    </article>
  );
}
