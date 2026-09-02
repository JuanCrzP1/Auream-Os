interface AutomationsHubHeaderProps {
  /** Deriva de `flows.length > 0 || folders.length > 0` en el hub. */
  hasContent: boolean;
  onCreateFlow: () => void;
}

/**
 * AutomationsHubHeader — cabecera del hub de automatizaciones.
 *
 * Responsabilidad única: título + acción de creación.
 * Sin estado ni lógica de negocio: `hasContent` decide si la acción vive aquí
 * (estado con contenido) o en el empty state central (estado vacío), nunca en
 * los dos sitios a la vez.
 */
export function AutomationsHubHeader({ hasContent, onCreateFlow }: AutomationsHubHeaderProps) {
  return (
    <header className="hub-header">
      <div className="hub-header__left">
        <h1 className="hub-header__title">Automatizaciones</h1>
      </div>
      {hasContent && (
        <div className="hub-header__right">
          <button type="button" className="hub-header__new-btn" onClick={onCreateFlow}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva
          </button>
        </div>
      )}
    </header>
  );
}
