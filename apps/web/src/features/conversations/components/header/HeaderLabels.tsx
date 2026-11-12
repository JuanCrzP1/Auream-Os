import { useLayoutEffect, useRef, useState } from "react";
import type { ConversationLabel } from "@contracts/ConversationContracts";

/** Lo que ocupa el «+N» al final (con su separación). */
const MORE_WIDTH = 40;
const GAP = 4;

/**
 * Las etiquetas del cliente debajo de su número, en UNA línea: las que caben
 * y un «+N» con las demás (sus nombres al pasar el mouse). Tocar cualquiera
 * abre la info del contacto, donde se ven todas y se ponen o quitan. Sin
 * etiquetas no ocupa espacio.
 */
export function HeaderLabels({ labels, onOpen }: { readonly labels: ReadonlyArray<ConversationLabel>; readonly onOpen: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(labels.length);

  useLayoutEffect(() => {
    const container = box.current;
    const ruler = measure.current;
    if (!container || !ruler) return;
    const compute = () => {
      const widths = [...ruler.children].map((child) => (child as HTMLElement).offsetWidth);
      const available = container.clientWidth;
      // jsdom (pruebas) no mide: se muestran todas.
      if (available === 0) return setFit(labels.length);
      let used = 0;
      let count = 0;
      for (const [index, width] of widths.entries()) {
        const rest = labels.length - (index + 1);
        if (used + width + (rest > 0 ? MORE_WIDTH : 0) > available) break;
        used += width + GAP;
        count += 1;
      }
      setFit(count);
    };
    compute();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(compute);
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [labels]);

  if (labels.length === 0) return null;
  const hidden = labels.slice(fit);
  const chip = (label: ConversationLabel) => (
    <span key={label.id} className="header-label" style={{ ["--label-color" as string]: label.color }}>
      <span className="header-label__dot" aria-hidden="true" />
      {label.name}
    </span>
  );

  return (
    <div className="header-labels" ref={box}>
      <button type="button" className="header-labels__row" aria-label={`Etiquetas: ${labels.map((label) => label.name).join(", ")}. Ver o cambiar`} title="Ver o cambiar las etiquetas" onClick={onOpen}>
        {labels.slice(0, fit).map(chip)}
        {hidden.length > 0 ? <span className="header-label header-label--more" title={hidden.map((label) => label.name).join(", ")}>+{hidden.length}</span> : null}
      </button>
      <div className="header-labels__ruler" ref={measure} aria-hidden="true">
        {labels.map(chip)}
      </div>
    </div>
  );
}
