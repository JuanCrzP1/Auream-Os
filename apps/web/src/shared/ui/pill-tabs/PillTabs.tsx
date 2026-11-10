import "./pill-tabs.css";

export interface PillTab<T extends string> {
  readonly id: T;
  readonly label: string;
  /** Número junto al nombre («Miembros · 3»). */
  readonly count?: number;
  /** El número pide atención («Por revisar» con pendientes): va en una insignia ámbar. */
  readonly alert?: boolean;
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
          {tab.count === undefined ? tab.label : tab.alert && tab.count > 0 ? (
            <>
              {tab.label} <span className="pill-tabs__badge">{tab.count}</span>
            </>
          ) : (
            `${tab.label} · ${tab.count}`
          )}
        </button>
      ))}
    </div>
  );
}
