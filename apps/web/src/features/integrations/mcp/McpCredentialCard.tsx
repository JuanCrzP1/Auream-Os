import type { McpCredentialSummary } from "@contracts/McpContracts";
import { formatDateTime } from "@shared/format/formatDate";
import { IntegrationMark } from "../components/ProviderMark";
import { permissionSummary } from "./permissionSummary";

/** Una credencial: sus permisos, la pista del token, último uso, vencimiento y revocar. */
export function McpCredentialCard({ credential, now = new Date(), onRevoke }: { readonly credential: McpCredentialSummary; readonly now?: Date; readonly onRevoke: () => void }) {
  const expired = credential.expiresAt !== null && Date.parse(credential.expiresAt) <= now.getTime();
  return (
    <article className="ai-card" aria-label={credential.name}>
      <header className="ai-card__head">
        <IntegrationMark kind="mcp" />
        <div className="ai-card__title">
          <h3>{credential.name}</h3>
          <p>Token {credential.hint}</p>
        </div>
        <span className={`ai-card__status ai-card__status--${expired ? "ko" : "ok"}`}>
          <span className="ai-card__status-dot" aria-hidden="true" />
          {expired ? "Vencida" : credential.lastUsedAt ? "Conectada" : "Sin usar"}
        </span>
      </header>
      <ul className="mcp-scopes" aria-label="Permisos">
        {permissionSummary(credential.permissions).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <dl className="ai-card__facts">
        <div>
          <dt>Último uso</dt>
          <dd>{credential.lastUsedAt ? formatDateTime(credential.lastUsedAt) : "Nunca"}</dd>
        </div>
        <div>
          <dt>Vence</dt>
          <dd>{credential.expiresAt ? formatDateTime(credential.expiresAt) : "No vence"}</dd>
        </div>
      </dl>
      <footer className="ai-card__actions">
        <button type="button" className="ui-btn ui-btn--ghost mcp-revoke" onClick={onRevoke}>
          Revocar
        </button>
      </footer>
    </article>
  );
}
