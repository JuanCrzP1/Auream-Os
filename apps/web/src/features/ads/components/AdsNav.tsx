import "./ads-nav.css";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

/** Verde si funciona, ámbar si algo falla, gris si todavía no hay nada. */
export type AdsNavTone = "ok" | "warn" | "idle";

export interface AdsNavStatus {
  readonly tone: AdsNavTone;
  /** «1 activo», «Sin conectar»… */
  readonly text: string;
}

export interface AdsNavItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon: ReactNode;
  readonly status: AdsNavStatus;
}

export const adsTabId = (id: string) => `ads-tab-${id}`;
export const adsLabelId = (id: string) => `ads-tab-${id}-label`;
export const adsPanelId = (id: string) => `ads-panel-${id}`;

/** Flechas: derecha y abajo avanzan; izquierda y arriba retroceden. */
const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Las secciones de Meta Ads como tarjetas de estado, no como pestañas
 * subrayadas: cada una dice cómo está (verde si funciona, ámbar si algo falla)
 * y la elegida se enciende con el degradado de Auream. Por dentro es una lista
 * de pestañas accesible: flechas, Inicio y Fin para moverse, y una sola
 * tarjeta en el orden del tabulador.
 */
export function AdsNav<T extends string>({
  items,
  selected,
  onSelect
}: {
  readonly items: ReadonlyArray<AdsNavItem<T>>;
  readonly selected: T;
  readonly onSelect: (id: T) => void;
}) {
  const tiles = useRef(new Map<T, HTMLButtonElement | null>());

  // En la fila deslizable (paneles angostos), la tarjeta elegida siempre a la
  // vista: también al abrir la página con `?tab=accounts` o desde un botón.
  useEffect(() => {
    const tile = tiles.current.get(selected);
    if (typeof tile?.scrollIntoView === "function") tile.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = STEP[event.key];
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : step === undefined ? null : (index + step + items.length) % items.length;
    if (next === null) return;
    event.preventDefault();
    const target = items[next];
    onSelect(target.id);
    tiles.current.get(target.id)?.focus();
  };

  return (
    <div className="ads-nav-wrap">
      <div className="ads-nav" role="tablist" aria-label="Secciones de Meta Ads">
        {items.map((item, index) => {
          const on = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tiles.current.set(item.id, node);
              }}
              type="button"
              role="tab"
              id={adsTabId(item.id)}
              aria-selected={on}
              aria-controls={on ? adsPanelId(item.id) : undefined}
              aria-labelledby={adsLabelId(item.id)}
              aria-describedby={`${adsTabId(item.id)}-status`}
              tabIndex={on ? 0 : -1}
              className="ads-nav__tile"
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <TileContent item={item} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TileContent<T extends string>({ item }: { readonly item: AdsNavItem<T> }) {
  return (
    <>
      <span className="ads-nav__icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="ads-nav__label" id={adsLabelId(item.id)}>
        {item.label}
      </span>
      <span className={`ads-nav__status ads-nav__status--${item.status.tone}`} id={`${adsTabId(item.id)}-status`}>
        <span className="ads-nav__dot" aria-hidden="true" />
        <span className="ads-nav__status-text">{item.status.text}</span>
      </span>
    </>
  );
}
