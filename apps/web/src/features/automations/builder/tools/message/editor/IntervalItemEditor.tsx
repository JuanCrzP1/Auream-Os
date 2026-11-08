import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MessageIntervalItem, MessageIntervalUnit } from "../types";
import { MESSAGE_INTERVAL_UNITS } from "../messageItems";

interface IntervalItemEditorProps {
  readonly item: MessageIntervalItem;
  readonly position: number;
  readonly onEdit: (change: { amount: number } | { unit: MessageIntervalUnit }) => void;
}

/**
 * Máximo del deslizador por unidad. Es un tope del control, no del dato: si lo
 * guardado lo supera, el deslizador se estira para representarlo.
 */
const SLIDER_MAX: Readonly<Record<MessageIntervalUnit, number>> = {
  seconds: 60,
  minutes: 60,
  hours: 24
};

/** Alto aproximado del menú, para abrir hacia arriba si no cabe debajo. */
const MENU_HEIGHT = MESSAGE_INTERVAL_UNITS.length * 30 + 10;

/** Ancho mínimo («segundos» es la más larga). */
const MENU_WIDTH = 112;

interface MenuBox {
  readonly top: number;
  readonly left: number;
  readonly minWidth: number;
}

/**
 * Selector de unidad propio en lugar de `<select>`, cuyo desplegable nativo no
 * admite tema oscuro.
 *
 * Se monta por portal en `.message-editor`: `.message-item` recorta y lleva un
 * `transform` en su animación de entrada, que convertiría el `position: fixed`
 * del menú en relativo a la tarjeta. En `.message-editor` no hay transform y el
 * menú sigue heredando las variables de tema.
 */
function UnitPicker({
  value,
  position,
  onChange
}: {
  readonly value: MessageIntervalUnit;
  readonly position: number;
  readonly onChange: (unit: MessageIntervalUnit) => void;
}) {
  const [box, setBox] = useState<MenuBox | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = box !== null;

  const label = MESSAGE_INTERVAL_UNITS.find((unit) => unit.value === value)?.label ?? value;

  const host = () => triggerRef.current?.closest<HTMLElement>(".message-editor") ?? null;

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const fitsBelow = window.innerHeight - rect.bottom > MENU_HEIGHT + 8;
    const width = Math.max(rect.width, MENU_WIDTH);
    setBox({
      top: fitsBelow ? rect.bottom + 6 : rect.top - MENU_HEIGHT - 6,
      // Acotado contra el borde derecho de la pantalla.
      left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      minWidth: width
    });
  };

  useEffect(() => {
    if (!open) return;

    const close = () => setBox(null);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // El marco del nodo cierra el editor con Escape en `window`; este
      // manejador va antes (en `document`) y evita que el mismo Escape descarte
      // lo escrito. Solo está registrado con el menú abierto.
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // El menú vive en coordenadas de pantalla: al desplazar se cierra.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const hostElement = box ? host() : null;

  return (
    <span className="message-interval__unit-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="message-interval__unit nodrag"
        aria-label={`Unidad de la pausa del bloque ${position}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setBox(null) : openMenu())}
      >
        {label}
        <span className="message-interval__caret" aria-hidden="true" />
      </button>

      {box &&
        hostElement &&
        createPortal(
          <div
            ref={menuRef}
            className="message-interval__menu nodrag nowheel"
            role="listbox"
            aria-label={`Unidades para el bloque ${position}`}
            style={{ top: box.top, left: box.left, minWidth: box.minWidth }}
          >
            {MESSAGE_INTERVAL_UNITS.map((unit) => (
              <button
                key={unit.value}
                type="button"
                role="option"
                aria-selected={unit.value === value}
                className={`message-interval__option${unit.value === value ? " message-interval__option--active" : ""}`}
                onClick={() => {
                  onChange(unit.value);
                  setBox(null);
                  triggerRef.current?.focus();
                }}
              >
                {unit.label}
              </button>
            ))}
          </div>,
          hostElement
        )}
    </span>
  );
}

/**
 * Pausa entre bloques: el bloque más compacto del editor (cantidad, unidad y
 * deslizador). Sin rótulo visible: la cabecera ya dice «Intervalo» y los
 * controles conservan su nombre accesible. Guarda la duración; no la ejecuta.
 */
export function IntervalItemEditor({ item, position, onEdit }: IntervalItemEditorProps) {
  const max = Math.max(SLIDER_MAX[item.unit], item.amount);
  const fill = ((item.amount - 1) / Math.max(max - 1, 1)) * 100;

  return (
    <div className="message-item__body">
      <div className="message-interval">
        <input
          type="number"
          min={1}
          className="message-interval__amount nodrag"
          value={item.amount}
          onChange={(event) => {
            const value = Number(event.target.value);
            // Una pausa de cero o negativa no significa nada.
            onEdit({ amount: Number.isFinite(value) && value > 0 ? value : 1 });
          }}
          aria-label={`Duración de la pausa del bloque ${position}`}
        />

        <UnitPicker value={item.unit} position={position} onChange={(unit) => onEdit({ unit })} />
      </div>

      <input
        type="range"
        min={1}
        max={max}
        value={item.amount}
        className="message-interval__slider nodrag"
        style={{ "--interval-fill": `${fill}%` } as React.CSSProperties}
        onChange={(event) => onEdit({ amount: Number(event.target.value) })}
        aria-label={`Ajustar la duración de la pausa del bloque ${position}`}
      />
    </div>
  );
}
