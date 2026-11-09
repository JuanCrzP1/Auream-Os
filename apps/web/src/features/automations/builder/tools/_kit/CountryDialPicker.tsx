import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { COUNTRIES, type Country } from "./catalogs";
import "./countryDialPicker.css";

// ---------------------------------------------------------------------------
// Prefijo telefónico con bandera, como en Leona: el botón muestra la bandera y
// el prefijo (🇨🇴 +57); la lista, bandera, país y prefijo, con buscador (por
// nombre o por número). Guarda solo el prefijo («57»).
//
// Propio en lugar de `<select>`: el desplegable nativo no admite el tema oscuro
// ni muestra bien bandera y país. Se monta por portal en `.kit-editor` (sin
// transform, con las variables del tema y el acento del bloque) y se cierra al
// desplazar, como el selector de unidad del Intervalo.
// ---------------------------------------------------------------------------

const MENU_WIDTH = 264;
const MENU_HEIGHT = 300;

interface MenuBox {
  readonly top: number;
  readonly left: number;
}

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function matches(country: Country, query: string): boolean {
  const q = normalize(query.trim().replace(/^\+/, ""));
  return q === "" || normalize(country.name).includes(q) || country.dial.startsWith(q);
}

export function CountryDialPicker({
  value,
  onChange,
  ariaLabel = "Prefijo del país"
}: {
  readonly value: string;
  readonly onChange: (dial: string) => void;
  readonly ariaLabel?: string;
}) {
  const [box, setBox] = useState<MenuBox | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = box !== null;

  const selected = COUNTRIES.find((country) => country.dial === value);
  const options = useMemo(() => COUNTRIES.filter((country) => matches(country, query)), [query]);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsBelow = window.innerHeight - rect.bottom > MENU_HEIGHT + 8;
    setBox({
      top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - MENU_HEIGHT - 6),
      left: Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8)
    });
    setQuery("");
    setActive(Math.max(0, COUNTRIES.findIndex((country) => country.dial === value)));
  };

  const close = (focusTrigger: boolean) => {
    setBox(null);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (country: Country) => {
    onChange(country.dial);
    close(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScroll = (event: Event) => {
      // Desplazar la propia lista no la cierra.
      if (menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // La opción activa siempre a la vista al moverse con el teclado.
  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      // El editor se cierra con Escape: aquí solo se cierra la lista.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (options.length === 0 ? 0 : (current + step + options.length) % options.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = options[active];
      if (country) choose(country);
    }
  };

  const host = open ? triggerRef.current?.closest<HTMLElement>(".kit-editor") ?? document.body : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="kit-dial nodrag"
        aria-label={`${ariaLabel}: ${selected ? `${selected.name} +${selected.dial}` : `+${value}`}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openMenu())}
      >
        <span className="kit-dial__flag" aria-hidden="true">{selected?.flag ?? "🌐"}</span>
        <span className="kit-dial__code">+{value}</span>
        <span className="kit-dial__caret" aria-hidden="true" />
      </button>

      {box &&
        host &&
        createPortal(
          <div ref={menuRef} className="kit-dial__menu nodrag nowheel" style={{ top: box.top, left: box.left, width: MENU_WIDTH, maxHeight: MENU_HEIGHT }} onKeyDown={onKeyDown}>
            <input
              className="kit-dial__search"
              autoFocus
              value={query}
              placeholder="Buscar país o prefijo"
              aria-label="Buscar país o prefijo"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
            />
            <div className="kit-dial__list" role="listbox" aria-label={ariaLabel}>
              {options.map((country, index) => (
                <button
                  key={country.code}
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={country.dial === value}
                  className={`kit-dial__option${index === active ? " kit-dial__option--active" : ""}${country.dial === value ? " kit-dial__option--selected" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(country)}
                >
                  <span className="kit-dial__flag" aria-hidden="true">{country.flag}</span>
                  <span className="kit-dial__name">{country.name}</span>
                  <span className="kit-dial__option-code">+{country.dial}</span>
                </button>
              ))}
              {options.length === 0 ? <p className="kit-dial__empty">Ningún país coincide.</p> : null}
            </div>
          </div>,
          host
        )}
    </>
  );
}
