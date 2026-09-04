export type MediaSource = "file" | "url";

interface MediaSourceTabsProps {
  readonly active: MediaSource;
  readonly onChange: (source: MediaSource) => void;
  /** Para que las etiquetas accesibles digan de qué bloque son. */
  readonly position: number;
}

/**
 * Elegir de dónde sale el archivo: del dispositivo o de un enlace.
 *
 * Control segmentado, no dos botones sueltos ni un desplegable: las dos
 * opciones son excluyentes y ambas deben verse a la vez para que el usuario
 * entienda que existe la otra sin tener que abrir nada.
 *
 * Lo usan los cuatro tipos multimedia con el mismo código. El color lo hereda
 * del bloque a través de `--mi-accent`, así que Imagen se ve índigo, Video
 * magenta, Audio cian y Archivo teal sin que este componente sepa de tipos.
 *
 * `role="tablist"` con `aria-selected`: para un lector es lo que es —dos
 * pestañas— y no dos botones cualesquiera.
 */
export function MediaSourceTabs({ active, onChange, position }: MediaSourceTabsProps) {
  return (
    <div className="media-tabs" role="tablist" aria-label={`Origen del archivo del bloque ${position}`}>
      <button
        type="button"
        role="tab"
        aria-selected={active === "file"}
        className={`media-tabs__tab nodrag${active === "file" ? " media-tabs__tab--active" : ""}`}
        onClick={() => onChange("file")}
      >
        <span className="media-tabs__icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M8 11V3" />
            <path d="M5 6l3-3 3 3" />
            <path d="M3 11.5v1a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5v-1" />
          </svg>
        </span>
        Archivo
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={active === "url"}
        className={`media-tabs__tab nodrag${active === "url" ? " media-tabs__tab--active" : ""}`}
        onClick={() => onChange("url")}
      >
        <span className="media-tabs__icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.3-2.3a2.6 2.6 0 0 0-3.7-3.7l-.8.8" />
            <path d="M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.4 8.9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" />
          </svg>
        </span>
        URL
      </button>
    </div>
  );
}
