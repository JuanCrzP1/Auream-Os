import "./empty-state.css";
import type { ReactNode } from "react";

/**
 * EmptyState — un módulo sin nada todavía (la primera vez). Como piden los
 * sistemas de diseño (Polaris, Atlassian, Material): un ícono, un título, una
 * o dos frases, la acción principal (y una secundaria) y, opcional, los pasos
 * en una línea. Corto, sin cifras ni nombres de ejemplo.
 */
export function EmptyState({ icon, title, description, actions, steps, label }: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly steps?: ReadonlyArray<string>;
  /** Nombre de la región (por defecto, el título). */
  readonly label?: string;
}) {
  return (
    <section className="empty-state" aria-label={label ?? title}>
      <div className="empty-state__main">
        <span className="empty-state__icon" aria-hidden="true">{icon}</span>
        <div className="empty-state__body">
          <h2 className="empty-state__title">{title}</h2>
          <p className="empty-state__text">{description}</p>
          {actions ? <div className="empty-state__actions">{actions}</div> : null}
        </div>
      </div>
      {steps && steps.length > 0 ? (
        <ol className="empty-state__steps" aria-label="Cómo funciona">
          {steps.map((step, index) => (
            <li key={step}>
              <span className="empty-state__num">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
