import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Estados de una vista de Contactos cuando no hay tabla que mostrar: error,
// vacío o sin resultados. Una sola pieza para que todos se vean igual.
// ---------------------------------------------------------------------------

export type ContactsStateTone = "neutral" | "warning";

const ICONS = {
  offline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.6 8.2 4 4 0 0 1 18 16" />
      <path d="M12 12v4" />
      <path d="M12 19.5h.01" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 3H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-.6 1.4l-7.5 7.5a2 2 0 0 1-2.8 0l-6.5-6.5a2 2 0 0 1 0-2.8l7.5-7.5A2 2 0 0 1 12.5 3z" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
} as const;

export type ContactsStateIcon = keyof typeof ICONS;

export function ContactsState({
  icon,
  title,
  description,
  tone = "neutral",
  actions,
  role
}: {
  readonly icon: ContactsStateIcon;
  readonly title: string;
  readonly description: string;
  readonly tone?: ContactsStateTone;
  readonly actions?: ReactNode;
  /** `alert` para errores: lo anuncian los lectores de pantalla. */
  readonly role?: "alert" | "status";
}) {
  return (
    <div className={`contacts-state contacts-state--${tone}`} role={role}>
      <span className="contacts-state__icon" aria-hidden="true">
        {ICONS[icon]}
      </span>
      <h2 className="contacts-state__title">{title}</h2>
      <p className="contacts-state__description">{description}</p>
      {actions ? <div className="contacts-state__actions">{actions}</div> : null}
    </div>
  );
}

/** Botón de reintentar con su propio estado de carga. */
export function RetryButton({ busy, onRetry }: { readonly busy: boolean; readonly onRetry: () => void }) {
  return (
    <button type="button" className="contacts-btn contacts-btn--ghost" onClick={onRetry} disabled={busy} aria-busy={busy}>
      <svg className={`contacts-retry-icon${busy ? " contacts-retry-icon--spinning" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4h-4" />
      </svg>
      {busy ? "Reintentando…" : "Reintentar"}
    </button>
  );
}

/** Filas de carga con la forma de la tabla: la página no salta al llegar los datos. */
export function ContactsTableSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="contacts-table-wrap contacts-skeleton" aria-busy="true" aria-label="Cargando contactos">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="contacts-skeleton__row">
          <span className="contacts-skeleton__avatar" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--name" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--phone" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--chip" />
        </div>
      ))}
    </div>
  );
}
