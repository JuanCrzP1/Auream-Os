import "./state-card.css";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Tarjeta de estado de una vista sin datos que mostrar: error, vacío o sin
// resultados. Una sola pieza para que todos los módulos se vean igual.
// ---------------------------------------------------------------------------

export type StateTone = "neutral" | "warning";

export function StateCard({
  icon,
  title,
  description,
  tone = "neutral",
  actions,
  role
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly tone?: StateTone;
  readonly actions?: ReactNode;
  /** `alert` para errores: lo anuncian los lectores de pantalla. */
  readonly role?: "alert" | "status";
}) {
  return (
    <div className={`ui-state ui-state--${tone}`} role={role}>
      <span className="ui-state__icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="ui-state__title">{title}</h2>
      <p className="ui-state__description">{description}</p>
      {actions ? <div className="ui-state__actions">{actions}</div> : null}
    </div>
  );
}

/** Botón de reintentar con su propio estado de carga. */
export function RetryButton({ busy, onRetry }: { readonly busy: boolean; readonly onRetry: () => void }) {
  return (
    <button type="button" className="ui-btn ui-btn--ghost" onClick={onRetry} disabled={busy} aria-busy={busy}>
      <svg className={`ui-retry-icon${busy ? " ui-retry-icon--spinning" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4h-4" />
      </svg>
      {busy ? "Reintentando…" : "Reintentar"}
    </button>
  );
}
