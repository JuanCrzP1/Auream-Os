interface AutomationSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function AutomationSearchBar({ value, onChange }: AutomationSearchBarProps) {
  return (
    <div className="hub-search">
      <span className="hub-search__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="search"
        className="hub-search__input"
        placeholder="Buscar automatizaciones..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar automatizaciones"
      />
    </div>
  );
}
