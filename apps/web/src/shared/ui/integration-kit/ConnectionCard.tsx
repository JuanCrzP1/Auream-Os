import "./integration-card.css";
import { useState, type ReactNode } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

/**
 * Tarjeta de una conexión con un servicio (IA, píxel de Meta…): distintivo, nombre,
 * estado, datos, aviso si el servicio la rechazó y acciones. Cada sección le
 * pasa sus datos; la tarjeta no sabe de qué servicio es.
 */
export function ConnectionCard({
  mark,
  name,
  subtitle,
  active,
  facts,
  invalidWarning,
  invalidLabel,
  activeLabel = "Activa",
  replaceLabel,
  onVerify,
  onRename,
  onReplaceSecret,
  onDelete
}: {
  readonly mark: ReactNode;
  readonly name: string;
  readonly subtitle: string;
  readonly active: boolean;
  readonly facts: ReadonlyArray<{ readonly label: string; readonly value: string; readonly mono?: boolean }>;
  readonly invalidWarning: string;
  /** Etiqueta de estado cuando el servicio rechazó el secreto («Clave rechazada»). */
  readonly invalidLabel: string;
  /** Etiqueta de estado cuando funciona, concordando con lo que se conecta: «Activa» (una clave), «Activo» (un píxel). */
  readonly activeLabel?: string;
  readonly replaceLabel: string;
  readonly onVerify: () => Promise<unknown>;
  readonly onRename: () => void;
  readonly onReplaceSecret: () => void;
  readonly onDelete: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <article className="ai-card" aria-label={name}>
      <header className="ai-card__head">
        {mark}
        <div className="ai-card__title">
          <h3>{name}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={`ai-card__status ai-card__status--${active ? "ok" : "ko"}`}>
          <span className="ai-card__status-dot" aria-hidden="true" />
          {active ? activeLabel : invalidLabel}
        </span>
      </header>

      <dl className="ai-card__facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd className={fact.mono ? "ai-card__hint" : undefined}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      {!active ? <p className="ai-card__warning">{invalidWarning}</p> : null}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}

      <footer className="ai-card__actions">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => void verify()} disabled={verifying}>
          {verifying ? "Verificando…" : "Verificar"}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onReplaceSecret}>
          {replaceLabel}
        </button>
        <button type="button" className="ai-card__icon-btn" onClick={onRename} aria-label={`Renombrar ${name}`} title="Renombrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
          </svg>
        </button>
        <button type="button" className="ai-card__icon-btn ai-card__icon-btn--danger" onClick={onDelete} aria-label={`Eliminar ${name}`} title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </footer>
    </article>
  );
}
