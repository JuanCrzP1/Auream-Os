import { useState } from "react";
import { aiProviderInfo, type AiCredentialSummary } from "@contracts/AiContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { ProviderMark } from "./ProviderMark";
import { formatDateTime } from "./formatDate";

/** Una conexión de IA: proveedor, nombre, pista de la clave, estado y acciones. */
export function AiCredentialCard({
  credential,
  onVerify,
  onRename,
  onReplaceKey,
  onDelete
}: {
  readonly credential: AiCredentialSummary;
  readonly onVerify: () => Promise<unknown>;
  readonly onRename: () => void;
  readonly onReplaceKey: () => void;
  readonly onDelete: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = aiProviderInfo(credential.provider);
  const active = credential.status === "active";

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      await onVerify();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo verificar ahora. Inténtalo de nuevo."));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <article className="ai-card" aria-label={credential.name}>
      <header className="ai-card__head">
        <ProviderMark provider={credential.provider} />
        <div className="ai-card__title">
          <h3>{credential.name}</h3>
          <p>{provider.name}</p>
        </div>
        <span className={`ai-card__status ai-card__status--${active ? "ok" : "ko"}`}>
          <span className="ai-card__status-dot" aria-hidden="true" />
          {active ? "Activa" : "Clave rechazada"}
        </span>
      </header>

      <dl className="ai-card__facts">
        <div>
          <dt>Clave</dt>
          <dd className="ai-card__hint">{credential.hint}</dd>
        </div>
        <div>
          <dt>Verificada</dt>
          <dd>{credential.lastVerifiedAt ? formatDateTime(credential.lastVerifiedAt) : "Nunca"}</dd>
        </div>
      </dl>

      {!active ? <p className="ai-card__warning">El proveedor ya no acepta esta clave: los bloques que la usan saldrán por «Error». Cámbiala por una nueva.</p> : null}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}

      <footer className="ai-card__actions">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => void verify()} disabled={verifying}>
          {verifying ? "Verificando…" : "Verificar"}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onReplaceKey}>
          Cambiar clave
        </button>
        <button type="button" className="ai-card__icon-btn" onClick={onRename} aria-label={`Renombrar ${credential.name}`} title="Renombrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
          </svg>
        </button>
        <button type="button" className="ai-card__icon-btn ai-card__icon-btn--danger" onClick={onDelete} aria-label={`Eliminar ${credential.name}`} title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </footer>
    </article>
  );
}
