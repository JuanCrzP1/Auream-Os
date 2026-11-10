import "./integration-card.css";
import "./integration-section.css";
import type { ReactNode } from "react";
import { StateCard } from "@shared/ui/state/StateCard";
import { ConnectionListNotice, type ConnectionListStatus } from "./ConnectionListNotice";

export type { ConnectionListStatus } from "./ConnectionListNotice";

/**
 * Una sección de conexiones (las de IA en Integraciones…): título, botón de
 * conectar y los estados comunes (cargando, sin acceso, no disponible, error,
 * vacío). La sección concreta solo aporta sus tarjetas y diálogos. Las que
 * traen su propio diseño (el Píxel en Meta Ads) usan solo `ConnectionListNotice`.
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
  /** Cómo se nombra lo que lista, para los avisos: «tus claves». */
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
  const titleId = `${id}-section-title`;

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

      {status !== "ready" ? (
        <ConnectionListNotice status={status} title={title} noun={noun} onRetry={onRetry} />
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
