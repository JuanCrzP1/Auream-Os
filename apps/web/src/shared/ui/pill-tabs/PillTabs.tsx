import "./pill-tabs.css";

export interface PillTab<T extends string> {
  readonly id: T;
  readonly label: string;
  /** Número junto al nombre («Por revisar · 3»). */
  readonly count?: number;
}

/**
 * Pestañas en cápsula (Equipo, Ventas): la elegida se levanta como una
 * tarjeta. Solo pinta y avisa; dónde vive la pestaña (normalmente `?tab=`) lo
 * decide la página.
 */
export function PillTabs<T extends string>({
  tabs,
  selected,
  label,
  onSelect
}: {
  readonly tabs: ReadonlyArray<PillTab<T>>;
  readonly selected: T;
  readonly label: string;
  readonly onSelect: (id: T) => void;
}) {
  return (
    <div className="pill-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={tab.id === selected} className="pill-tabs__tab" onClick={() => onSelect(tab.id)}>
          {tab.count === undefined ? tab.label : `${tab.label} · ${tab.count}`}
        </button>
      ))}
    </div>
  );
}
