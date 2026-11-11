import "./help-crumbs.css";
import { Fragment } from "react";
import { HelpIcon } from "@shared/help/HelpIcons";

export interface Crumb {
  readonly label: string;
  /** Sin `onClick` es la página actual. */
  readonly onClick?: () => void;
}

/** La ruta de la ayuda: «Centro de ayuda › Módulo › Artículo». */
export function HelpCrumbs({ items }: { readonly items: ReadonlyArray<Crumb> }) {
  return (
    <nav className="help-crumbs" aria-label="Ruta">
      <ol>
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 ? <li className="help-crumbs__sep" aria-hidden="true"><HelpIcon name="chevron" size={14} /></li> : null}
            <li>
              {item.onClick ? (
                <button type="button" className="help-crumbs__link" onClick={item.onClick}>
                  {index === 0 ? <HelpIcon name="book" size={15} /> : null}
                  {item.label}
                </button>
              ) : (
                <span className="help-crumbs__current" aria-current="page">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
