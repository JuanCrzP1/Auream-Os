import { useState, type ReactNode } from "react";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";

export type ConnectionListStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * Una sección de Integraciones (IA, píxeles…): título, botón de conectar y
 * los estados comunes (cargando, sin acceso, no disponible, error, vacío).
 * La sección concreta solo aporta sus tarjetas y diálogos.
 */
export function IntegrationSection({
  id,
  title,
  noun,
  description,
  status,
  onRetry,
  count,
  connectLabel,
  onConnect,
  empty,
  dialogs,
  children
}: {
  readonly id: string;
  readonly title: string;
  /** Cómo se nombra lo que lista, para los avisos: «tus píxeles». */
  readonly noun: string;
  readonly description: string;
  readonly status: ConnectionListStatus;
  readonly onRetry: () => Promise<unknown>;
  readonly count: number;
  readonly connectLabel: string;
  readonly onConnect: () => void;
  readonly empty: { readonly icon: ReactNode; readonly title: string; readonly description: string };
  /** Tarjetas de las conexiones. */
  readonly children: ReactNode;
  /** Diálogos de la sección (conectar, editar, borrar). */
  readonly dialogs?: ReactNode;
}) {
  const [retrying, setRetrying] = useState(false);
  const titleId = `${id}-section-title`;

  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <section className="ui-panel" aria-labelledby={titleId}>
      <div className="integrations-section__head">
        <div>
          <h2 id={titleId} className="integrations-section__title">{title}</h2>
          <p className="ui-muted">{description}</p>
        </div>
        {status === "ready" && count > 0 ? (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onConnect}>
            {connectLabel}
          </button>
        ) : null}
      </div>

      {status === "error" || retrying ? (
        <StateCard
          role="alert"
          tone="warning"
          icon={StateIcons.offline}
          title={`No pudimos cargar ${noun}`}
          description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
          actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
        />
      ) : status === "unavailable" ? (
        <StateCard tone="warning" icon={StateIcons.lock} title={`${title}: no disponible`} description="El servidor todavía no tiene configurado el cifrado de secretos. Pide al administrador de la plataforma que lo active." />
      ) : status === "forbidden" ? (
        <StateCard icon={StateIcons.lock} title={`Sin acceso a ${noun}`} description="Tu rol no permite ver estas conexiones. Pide acceso a un administrador." />
      ) : status === "loading" ? (
        <div className="ai-grid" aria-busy="true" aria-label={`Cargando ${noun}`}>
          <div className="ai-card ai-card--skeleton" />
          <div className="ai-card ai-card--skeleton" />
        </div>
      ) : count === 0 ? (
        <StateCard
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
          actions={
            <button type="button" className="ui-btn ui-btn--primary" onClick={onConnect}>
              {connectLabel}
            </button>
          }
        />
      ) : (
        <div className="ai-grid">{children}</div>
      )}
      {dialogs}
    </section>
  );
}
