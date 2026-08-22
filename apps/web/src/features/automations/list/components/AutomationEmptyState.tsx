import "./hub-empty-state.css";
interface AutomationEmptyStateProps {
  onCreateFlow: () => void;
  onCreateFolder?: () => void;
  onExploreTemplates?: () => void;
}

export function AutomationEmptyState({
  onCreateFlow,
  onCreateFolder,
  onExploreTemplates,
}: AutomationEmptyStateProps) {
  return (
    <div className="hub-empty">
      <div className="hub-empty__inner">
        <div className="hub-empty__icon-wrap" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="15" r="6" stroke="currentColor" strokeWidth="2" />
            <path d="M32 21v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 32L16 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 32l16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="43" r="6" stroke="currentColor" strokeWidth="2" />
            <circle cx="48" cy="43" r="6" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <h2 className="hub-empty__title">Sin automatizaciones aún</h2>
        <p className="hub-empty__desc">
          Crea tu primera automatización, organízalas en carpetas o parte desde una plantilla.
        </p>
        <div className="hub-empty__actions">
          <button type="button" className="hub-empty__btn hub-empty__btn--primary" onClick={onCreateFlow}>
            <span className="hub-empty__btn-plus" aria-hidden="true">+</span>
            Nueva automatización
          </button>
          <button type="button" className="hub-empty__btn hub-empty__btn--secondary" onClick={onCreateFolder}>
            Nueva carpeta
          </button>
          <button type="button" className="hub-empty__btn hub-empty__btn--secondary" onClick={onExploreTemplates}>
            Explorar plantillas
          </button>
        </div>
      </div>
    </div>
  );
}
