import "./how-it-works.css";
import { useCallback, useId, useState, type ReactNode } from "react";

export interface HowStep {
  readonly icon: ReactNode;
  readonly title: string;
  /** Un dibujo pequeño de ese paso (un campo, un mensaje, una burbuja). */
  readonly demo: ReactNode;
}

const STORAGE_PREFIX = "auream.how-it-works.";

function readClosed(id: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === "closed";
  } catch {
    return false;
  }
}

/**
 * Si el cuadro «Cómo funciona» está abierto. Cerrado con «Entendido» se
 * recuerda en el navegador de esa persona; `always` lo deja abierto (p. ej.
 * cuando aún no hay nada creado, que es cuando más se necesita).
 */
export function useHowItWorks(id: string, always = false) {
  const [closed, setClosed] = useState(() => readClosed(id));
  const remember = useCallback(
    (value: boolean) => {
      setClosed(value);
      try {
        if (value) window.localStorage.setItem(STORAGE_PREFIX + id, "closed");
        else window.localStorage.removeItem(STORAGE_PREFIX + id);
      } catch {
        // Sin almacenamiento (ventana privada): se cierra solo por ahora.
      }
    },
    [id]
  );
  return { open: always || !closed, canClose: !always, close: () => remember(true), reopen: () => remember(false) };
}

/**
 * «Cómo funciona»: qué es la pantalla en una frase, los pasos con un dibujo
 * cada uno y, abajo, lo que conviene saber. Igual en todas las pantallas que
 * lo usan (Datos del negocio, Campos del cliente).
 */
export function HowItWorks({
  title,
  description,
  steps,
  footer,
  onClose
}: {
  readonly title: string;
  readonly description: string;
  readonly steps: ReadonlyArray<HowStep>;
  readonly footer?: ReactNode;
  /** Sin él no hay «Entendido». */
  readonly onClose?: () => void;
}) {
  const titleId = useId();
  return (
    <section className="how" aria-labelledby={titleId}>
      <header className="how__head">
        <div>
          <span className="how__eyebrow">Cómo funciona</span>
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
        </div>
        {onClose ? (
          <button type="button" className="how__close" onClick={onClose}>
            Entendido
          </button>
        ) : null}
      </header>
      <ol className="how__steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <div className="how__title">
              <span className="how__icon" aria-hidden="true">{step.icon}</span>
              <div>
                <small>Paso {index + 1}</small>
                {step.title}
              </div>
            </div>
            {step.demo}
          </li>
        ))}
      </ol>
      {footer ? <footer className="how__foot">{footer}</footer> : null}
    </section>
  );
}

/** El botón que lo vuelve a abrir cuando está cerrado. */
export function HowItWorksButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button type="button" className="how-button" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      ¿Cómo funciona?
    </button>
  );
}

/** Los dibujos de cada paso: un campo con su valor, un mensaje con su clave y la burbuja que lee el cliente. */
export const HowDemo = {
  Field: ({ label, value }: { readonly label: string; readonly value: string }) => (
    <span className="how-demo how-demo--field"><small>{label}</small>{value}</span>
  ),
  Message: ({ children }: { readonly children: ReactNode }) => <span className="how-demo how-demo--message">{children}</span>,
  Key: ({ children }: { readonly children: string }) => <code className="how-demo__key">{children}</code>,
  Bubble: ({ children }: { readonly children: ReactNode }) => (
    <span className="how-demo how-demo--chat">
      <span className="how-demo__bubble">{children}<time>9:41</time></span>
    </span>
  ),
  Value: ({ children }: { readonly children: ReactNode }) => <mark className="how-demo__value">{children}</mark>
};

/** Íconos de línea de los pasos (24×24). */
export const HowIcons = {
  create: <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>,
  write: <svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>,
  read: <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12z" /></svg>,
  ask: <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.8 7L5 20l1.1-4A8 8 0 1 1 21 12z" /><path d="M10.5 9.5a2 2 0 1 1 2.6 1.9c-.6.2-1.1.7-1.1 1.4v.2M12 15.5h.01" /></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>,
  person: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
};
