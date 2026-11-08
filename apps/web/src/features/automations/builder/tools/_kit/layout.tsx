import "./kit.css";
import type { ComponentType, ReactNode } from "react";
import type { ToolOutput } from "../ToolDefinition";
import { editorAccent } from "./fields";
import { withSampleValues } from "./catalogs";

// ---------------------------------------------------------------------------
// Estructura visual de los editores: cabecera, secciones como tarjetas
// numeradas, tarjetas de elección, caminos de salida, estados vacíos y vista
// previa de chat. Solo presentación.
// ---------------------------------------------------------------------------

/** «1 salida», «3 salidas», «Salida única». */
function describeOutputs(outputs: ReadonlyArray<ToolOutput> | null | undefined): string | null {
  if (outputs === undefined) return null;
  if (outputs === null) return "Salida única";
  return outputs.length === 1 ? "1 salida" : `${outputs.length} salidas`;
}

/** Cabecera explicativa del editor: icono, título, qué hace y cuántas salidas tiene. */
export function EditorIntro({
  Icon,
  title,
  description,
  outputs,
  compact = false
}: {
  readonly Icon: ComponentType;
  readonly title: string;
  readonly description: string;
  /** `null` = salida única; ausente = no se muestra. */
  readonly outputs?: ReadonlyArray<ToolOutput> | null;
  readonly compact?: boolean;
}) {
  const outputsLabel = describeOutputs(outputs);

  return (
    <header className={`kit-intro${compact ? " kit-intro--compact" : ""}`}>
      <span className="kit-intro__icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="kit-intro__text">
        <p className="kit-intro__title">{title}</p>
        <p className="kit-intro__description">{description}</p>
      </div>
      {outputsLabel ? (
        <span className="kit-intro__chip">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 8h4M6.5 8l3-3.5M6.5 8l3 3.5" />
            <circle cx="11.5" cy="4.5" r="1.4" />
            <circle cx="11.5" cy="11.5" r="1.4" />
          </svg>
          {outputsLabel}
        </span>
      ) : null}
    </header>
  );
}

/** Contenedor del editor: acento, desplazamiento y cabecera explicativa. */
export function ToolEditorLayout({
  accent,
  Icon,
  title,
  description,
  outputs,
  className,
  children
}: {
  readonly accent: string;
  readonly Icon: ComponentType;
  readonly title: string;
  readonly description: string;
  readonly outputs?: ReadonlyArray<ToolOutput> | null;
  /** Clase raíz propia de la herramienta (para sus estilos y pruebas). */
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={`kit-editor kit-editor--cards${className ? ` ${className}` : ""}`} style={editorAccent(accent)}>
      <EditorIntro Icon={Icon} title={title} description={description} outputs={outputs} />
      {children}
    </div>
  );
}

export type OutputTone = "success" | "danger" | "warning" | "neutral";

/** Tono de una salida según su significado, deducido de su id persistido. */
export function outputTone(id: string): OutputTone {
  if (/^(success|valid|true|respuesta)$/.test(id)) return "success";
  if (/(failure|wrong|invalid|duplicate|^false$)/.test(id)) return "danger";
  if (/(timeout|tiempo|too-old)/.test(id)) return "warning";
  return "neutral";
}

/** Sección en tarjeta, con número de paso opcional. */
export function CardSection({
  step,
  title,
  description,
  aside,
  children
}: {
  readonly step?: number;
  readonly title: string;
  readonly description?: string;
  /** Contenido a la derecha de la cabecera (contador, interruptor…). */
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section className="kit-panel">
      <header className="kit-panel__head">
        {step !== undefined ? (
          <span className="kit-panel__step" aria-hidden="true">
            {step}
          </span>
        ) : null}
        <div className="kit-panel__heading">
          <h3 className="kit-panel__title">{title}</h3>
          {description ? <p className="kit-panel__description">{description}</p> : null}
        </div>
        {aside ? <div className="kit-panel__aside">{aside}</div> : null}
      </header>
      <div className="kit-panel__body">{children}</div>
    </section>
  );
}

export interface Choice<T extends string> {
  readonly value: T;
  readonly title: string;
  readonly description: string;
  readonly Icon?: ComponentType;
}

/** Decisión importante entre pocas opciones: tarjetas con icono y explicación. */
export function ChoiceCards<T extends string>({
  label,
  value,
  choices,
  onChange
}: {
  readonly label: string;
  readonly value: T;
  readonly choices: ReadonlyArray<Choice<T>>;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="kit-choices" role="radiogroup" aria-label={label} data-count={choices.length}>
      {choices.map(({ value: choice, title, description, Icon }) => {
        const selected = choice === value;
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={title}
            className={`kit-choice nodrag${selected ? " kit-choice--on" : ""}`}
            onClick={() => onChange(choice)}
          >
            {Icon ? (
              <span className="kit-choice__icon" aria-hidden="true">
                <Icon />
              </span>
            ) : null}
            <span className="kit-choice__text">
              <span className="kit-choice__title">{title}</span>
              <span className="kit-choice__description">{description}</span>
            </span>
            <span className="kit-choice__check" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Por dónde puede seguir el flujo desde este bloque. */
export function OutputsPreview({ outputs }: { readonly outputs: ReadonlyArray<ToolOutput> | null }) {
  return (
    <section className="kit-panel kit-panel--outputs">
      <header className="kit-panel__head">
        <span className="kit-panel__glyph" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="3.5" cy="8" r="1.6" />
            <path d="M5 8h3M8 8l3-3.5M8 8l3 3.5" />
            <circle cx="12.5" cy="4" r="1.4" />
            <circle cx="12.5" cy="12" r="1.4" />
          </svg>
        </span>
        <div className="kit-panel__heading">
          <h3 className="kit-panel__title">Caminos de salida</h3>
          <p className="kit-panel__description">
            {outputs === null
              ? "Este bloque tiene una sola salida: continúa al siguiente bloque."
              : "Conecta cada camino desde su punto en el lienzo."}
          </p>
        </div>
      </header>
      {outputs !== null ? (
        <ul className="kit-paths">
          {outputs.map((output) => (
            <li key={output.id} className={`kit-path kit-path--${outputTone(output.id)}`}>
              <span className="kit-path__dot" aria-hidden="true" />
              {output.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Estado vacío de una lista, con su acción principal. */
export function EmptyState({
  title,
  description,
  action
}: {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="kit-empty">
      <span className="kit-empty__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="14" rx="3" />
          <path d="M3.5 9.5h17M12 12.5v4M10 14.5h4" />
        </svg>
      </span>
      <p className="kit-empty__title">{title}</p>
      <p className="kit-empty__description">{description}</p>
      {action}
    </div>
  );
}

/** Conector «Y» / «O» entre tarjetas de una lista. */
export function Joiner({ label }: { readonly label: string }) {
  return (
    <li className="kit-joiner" aria-hidden="true">
      <span>{label}</span>
    </li>
  );
}

/** Contador «2 / 10» para cabeceras de sección. */
export function Counter({ value, max }: { readonly value: number; readonly max?: number }) {
  return <span className="kit-counter">{max !== undefined ? `${value} / ${max}` : value}</span>;
}

/**
 * Vista previa aproximada de un mensaje de WhatsApp: burbuja con título,
 * texto, pie y, si los hay, botones o el botón de lista. Las variables se
 * muestran con valores de ejemplo.
 */
export function ChatPreview({
  title,
  message,
  footer,
  buttons = [],
  listButton,
  caption = "Así lo verá en WhatsApp"
}: {
  readonly title?: string;
  readonly message: string;
  readonly footer?: string;
  readonly buttons?: ReadonlyArray<string>;
  readonly listButton?: string;
  readonly caption?: string;
}) {
  return (
    <figure className="kit-chat">
      <figcaption className="kit-chat__caption">{caption}</figcaption>
      <div className="kit-chat__wall">
        <div className="kit-chat__bubble">
          {title ? <p className="kit-chat__title">{withSampleValues(title)}</p> : null}
          <p className="kit-chat__message">{withSampleValues(message) || "…"}</p>
          {footer ? <p className="kit-chat__footer">{withSampleValues(footer)}</p> : null}
          <span className="kit-chat__time">10:24</span>
        </div>
        {listButton ? (
          <div className="kit-chat__action">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M3 4.5h10M3 8h10M3 11.5h10" />
            </svg>
            {listButton}
          </div>
        ) : null}
        {buttons.map((button, index) => (
          <div key={`${button}-${index}`} className="kit-chat__action">
            {button || `Opción ${index + 1}`}
          </div>
        ))}
      </div>
    </figure>
  );
}
